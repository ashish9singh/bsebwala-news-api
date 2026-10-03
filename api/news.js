export default async function handler(req, res) {
  // 1. Enable CORS for all domains
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 2. Cache response on Vercel's Edge CDN for 5 minutes (prevents rate limits and makes fetches instant)
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  try {
    // 3. Strict Search Query: Quotes ensure Google News only returns exact matches
    const searchQuery = encodeURIComponent('"Bihar Board" OR "BSEB" OR "बिहार बोर्ड" OR "OFSS Bihar" OR "Matric Bihar Board" OR "Inter Bihar Board" OR "Result Bihar Board" OR "Bihar School Examination Board"');
    const rssUrl = `https://news.google.com/rss/search?q=${searchQuery}&hl=en-IN&gl=IN&ceid=IN:en`;

    const response = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BSEBWalaNewsBot/1.0)'
      }
    });

    if (!response.ok) {
      throw new Error(`Upstream RSS request failed: ${response.statusText}`);
    }

    const xmlText = await response.text();

    // 4. Parse Items from XML using Regex (no external npm dependencies required)
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const items = [];
    let match;

    // Strict keyword whitelist to reject any stray political/general news
    const KEYWORDS = [
"Bihar Board", "BSEB", "Bihar School Examination Board", "Bihar Board latest news", "BSEB latest news", 
      "Bihar Board news", "BSEB news", "Bihar Board notice", "BSEB notice", "Bihar Board notification", 
      "BSEB notification", "Bihar Board latest update", "BSEB latest update", "Bihar Board official website", 
      "BSEB official website", "Bihar Board Matric", "Bihar Board 10th", "BSEB 10th", "BSEB Matric", 
      "Bihar Board Secondary", "Bihar Board Class 10", "Bihar Board 10th exam", "Bihar Board Matric exam", 
      "Bihar Board 10th exam date", "Bihar Board Matric exam date", "Bihar Board 10th routine", "Bihar Board Matric routine", 
      "Bihar Board 10th timetable", "Bihar Board Matric timetable", "Bihar Board 10th admit card", "Bihar Board Matric admit card", 
      "Bihar Board 10th exam center", "Bihar Board Matric exam center", "Bihar Board 10th syllabus", "Bihar Board Matric syllabus", 
      "Bihar Board 10th model paper", "Bihar Board Matric model paper", "Bihar Board 10th question paper", "Bihar Board Matric question paper", 
      "Bihar Board 10th answer key", "Bihar Board Matric answer key", "Bihar Board 10th result", "Bihar Board Matric result", "BSEB 10th result", 
      "BSEB Matric result", "Bihar Board 10th result date", "Bihar Board Matric result date", "Bihar Board 10th result link", "Bihar Board 10th result check", 
      "Bihar Board 10th marksheet", "Bihar Board Matric marksheet", "Bihar Board 10th topper", "Bihar Board Matric topper", "Bihar Board 10th scrutiny", 
      "Bihar Board Matric scrutiny", "Bihar Board 10th compartment", "Bihar Board Matric compartment", "Bihar Board 10th special exam", 
      "Bihar Board Matric special exam", "Bihar Board 10th registration", "BSEB 10th registration", "Bihar Board Matric registration", 
      "Bihar Board 10th registration form", "Bihar Board Matric registration form", "Bihar Board 10th registration date", "Bihar Board 10th registration last date", 
      "Bihar Board 10th registration fee", "Bihar Board 10th registration correction", "Bihar Board dummy registration card", "Bihar Board 10th dummy registration card", 
      "Bihar Board Matric dummy registration card", "Bihar Board registration number", "Bihar Board 10th exam form", "Bihar Board Matric exam form", 
      "BSEB 10th exam form", "Bihar Board 10th form fill up", "Bihar Board 10th exam form date", "Bihar Board 10th exam form last date", 
      "Bihar Board 10th exam form fee", "Bihar Board 10th online form", "Bihar Board 10th form correction", "Bihar Board 10th admit card download", 
      "Bihar Board Matric admit card download", "Bihar Board 10th admit card release date", "Bihar Board 10th dummy admit card", "Bihar Board 10th question paper", 
      "Bihar Board 10th previous year question paper", "Bihar Board 10th model question paper", "Bihar Board 10th practice set", "Bihar Board 10th important questions", 
      "Bihar Board 10th MCQ", "Bihar Board 10th notes", "Bihar Board 10th notes PDF", "Bihar Board 10th study material", "Bihar Board 10th preparation", 
      "Bihar Board 10th Hindi", "Bihar Board 10th English", "Bihar Board 10th Mathematics", "Bihar Board 10th Science", "Bihar Board 10th Social Science", 
      "Bihar Board 10th Sanskrit", "Bihar Board 10th Urdu", "Bihar Board 12th", "BSEB 12th", "Bihar Board Intermediate", "BSEB Intermediate", "Bihar Board Inter", 
      "Bihar Board Senior Secondary", "BSEB Senior Secondary", "Bihar Board Class 12", "Bihar Board 12th exam", "Bihar Board Inter exam", "Bihar Board 12th exam date", 
      "Bihar Board Inter exam date", "Bihar Board 12th routine", "Bihar Board Inter routine", "Bihar Board 12th timetable", "Bihar Board Inter timetable", 
      "Bihar Board 12th admit card", "Bihar Board Inter admit card", "Bihar Board 12th exam center", "Bihar Board Inter exam center", "Bihar Board 12th syllabus", 
      "Bihar Board Inter syllabus", "Bihar Board 12th model paper", "Bihar Board Inter model paper", "Bihar Board 12th question paper", "Bihar Board Inter question paper",
      "Bihar Board 12th answer key", "Bihar Board Inter answer key", "Bihar Board 12th result", "Bihar Board Inter result", "BSEB 12th result", "BSEB Inter result", 
      "Bihar Board 12th result date", "Bihar Board Inter result date", "Bihar Board 12th result link", "Bihar Board 12th result check", "Bihar Board 12th marksheet", 
      "Bihar Board Inter marksheet", "Bihar Board 12th topper", "Bihar Board Inter topper", "Bihar Board 12th scrutiny", "Bihar Board Inter scrutiny", 
      "Bihar Board 12th compartment", "Bihar Board Inter compartment", "Bihar Board 12th special exam", "Bihar Board Inter special exam", "Bihar Board 12th registration", 
      "BSEB 12th registration", "Bihar Board Inter registration", "Bihar Board Intermediate registration", "Bihar Board 12th registration form", 
      "Bihar Board Inter registration form", "Bihar Board 12th registration date", "Bihar Board 12th registration last date", "Bihar Board Inter registration last date", 
      "Bihar Board 12th registration fee", "Bihar Board 12th registration correction", "Bihar Board 12th dummy registration card", 
      "Bihar Board Inter dummy registration card", "Bihar Board 12th exam form", "Bihar Board Inter exam form", "BSEB 12th exam form", 
      "Bihar Board Intermediate exam form", "Bihar Board 12th form fill up", "Bihar Board Inter form fill up", "Bihar Board 12th exam form date", 
      "Bihar Board 12th exam form last date", "Bihar Board Inter exam form last date", "Bihar Board 12th exam form fee", "Bihar Board 12th online form", 
      "Bihar Board 12th form correction", "Bihar Board 12th admit card download", "Bihar Board Inter admit card download", "Bihar Board 12th admit card release date", 
      "Bihar Board 12th dummy admit card", "Bihar Board 12th previous year question paper", "Bihar Board 12th model question paper", "Bihar Board 12th practice set", 
      "Bihar Board 12th important questions", "Bihar Board 12th MCQ", "Bihar Board 12th notes", "Bihar Board 12th notes PDF", "Bihar Board 12th study material", 
      "Bihar Board 12th preparation", "Bihar Board 12th Hindi", "Bihar Board 12th English", "Bihar Board 12th Physics", "Bihar Board 12th Chemistry", 
      "Bihar Board 12th Mathematics", "Bihar Board 12th Biology", "Bihar Board 12th History", "Bihar Board 12th Political Science", "Bihar Board 12th Geography", 
      "Bihar Board 12th Economics", "Bihar Board 12th Accountancy", "Bihar Board 12th Business Studies", "Bihar Board 12th Computer Science", "OFSS Bihar", 
      "OFSS Bihar admission", "OFSS admission", "Bihar OFSS", "OFSS Bihar 11th admission", "OFSS Intermediate admission", "Bihar Board 11th admission", 
      "Bihar Board 11th admission form", "Bihar Board 11th admission date", "Bihar Board 11th admission last date", "Bihar Board 11th admission merit list", 
      "OFSS merit list", "OFSS selection list", "OFSS college list", "OFSS application form", "OFSS application status", "OFSS admission status", "OFSS correction", 
      "OFSS fee", "OFSS login", "Bihar Board 9th admission", "Bihar Board 9th admission form", "Bihar Board Class 9 admission", "Bihar Board school admission", 
      "Bihar government school admission", "Bihar school admission", "Bihar school admission date", "BBOSE", "BBOSE Bihar", "BBOSE 10th", "BBOSE 12th", 
      "BBOSE admission", "BBOSE registration", "BBOSE exam form", "BBOSE exam date", "BBOSE admit card", "BBOSE result", "BBOSE scrutiny", "BBOSE TOC", 
      "BBOSE 10th result", "BBOSE 12th result", "Bihar Education Department", "Bihar Shiksha Vibhag", "Bihar Education Department latest news", 
      "Bihar Shiksha Vibhag latest news", "Bihar education news", "Bihar school news", "Bihar Education Department notification", "Bihar Education Department order",
      "Bihar Education Department circular", "Bihar Education Department notice", "Bihar Education Department PDF", "Bihar government school news", 
      "Bihar government school update", "Bihar teacher news", "Bihar teacher latest news", "Bihar teacher notification", "Bihar teacher vacancy", 
      "Bihar teacher recruitment", "Bihar teacher recruitment 2027", "BPSC teacher", "BPSC TRE", "Bihar TRE", "TRE 4.0", "Bihar teacher transfer", 
      "Bihar teacher transfer policy", "Bihar teacher posting", "Bihar teacher joining", "Bihar teacher salary", "Bihar teacher pay scale", 
      "Bihar teacher promotion", "Bihar teacher training", "Bihar teacher training news", "Bihar teacher recruitment result", "Bihar teacher document verification", 
      "Bihar school holiday", "Bihar school holiday list", "Bihar school calendar", "Bihar school timing", "Bihar school timing today", "Bihar school opening time", 
      "Bihar school closing time", "Bihar school vacation", "Bihar school academic calendar", "Bihar school inspection", "Bihar school infrastructure", 
      "Bihar government school", "Bihar model school", "Bihar model school news", "Bihar smart classroom", "Bihar school computer lab", "Bihar school AI education", 
      "Bihar school digital education", "Bihar scholarship", "Bihar student scholarship", "Bihar Board scholarship", "Bihar Matric scholarship", 
      "Bihar Inter scholarship", "Bihar scholarship 2027", "Bihar scholarship form", "Bihar scholarship application", "Bihar scholarship last date", 
      "Bihar scholarship status", "Bihar scholarship payment", "Bihar scholarship amount", "Bihar scholarship list", "Post Matric Scholarship Bihar", 
      "PMS Bihar", "Bihar scholarship portal", "Bihar student scheme", "Bihar students scheme", "Bihar government student scheme", "Bihar student benefits", 
      "Bihar student financial assistance", "Bihar cycle scheme", "Bihar uniform scheme", "Bihar student credit card", "Bihar Student Credit Card", 
      "Bihar student loan", "Bihar education loan", "Bihar student scheme", "Bihar Board exam center", "Bihar Board exam center list", "BSEB exam center list", 
      "Bihar Board practical exam", "Bihar Board practical exam date", "Bihar Board practical admit card", "Bihar Board practical marks", 
      "Bihar Board practical exam center", "Bihar Board internal assessment", "Bihar Board project work", "Bihar Board practical copy", "Bihar Board dummy card", 
      "BSEB dummy registration card", "Bihar Board dummy card download", "Bihar Board dummy card correction", "Bihar Board dummy card correction date", 
      "Bihar Board name correction", "Bihar Board photo correction", "Bihar Board father's name correction", "Bihar Board mother's name correction", 
      "Bihar Board date of birth correction", "Bihar Board gender correction", "Bihar Board subject correction", "Bihar Board school correction", 
      "Bihar Board mobile number correction", "BSEB notice PDF", "Bihar Board notice PDF", "Bihar Board notification PDF", "BSEB notification PDF", 
      "Bihar Board official PDF", "Bihar Board latest notice PDF", "BSEB latest notice", "Bihar Board circular PDF", "BSEB circular", "Bihar Board विज्ञप्ति", 
      "BSEB विज्ञप्ति", "Bihar Board आदेश", "BSEB आदेश", "Bihar Board सूचना", "BSEB सूचना", "Bihar Board latest news today", "BSEB latest news today", 
      "Bihar education news today", "Bihar school news today", "Bihar teacher news today", "Bihar Education Department latest news", 
      "Bihar Board new notice today", "Bihar Board new notification", "Bihar Board important notice", "बिहार बोर्ड", "बिहार बोर्ड मैट्रिक", "बिहार बोर्ड इंटर", 
      "बिहार बोर्ड 10वीं", "बिहार बोर्ड 12वीं", "बिहार बोर्ड परीक्षा", "बिहार बोर्ड परीक्षा फॉर्म", "बिहार बोर्ड रजिस्ट्रेशन", "बिहार बोर्ड पंजीयन", "बिहार बोर्ड एडमिट कार्ड", "बिहार बोर्ड रिजल्ट", 
      "बिहार बोर्ड स्क्रूटिनी", "बिहार बोर्ड कंपार्टमेंट", "बिहार बोर्ड मॉडल पेपर", "बिहार बोर्ड प्रश्न पत्र", "बिहार बोर्ड उत्तर कुंजी", "बिहार बोर्ड सिलेबस", "बिहार बोर्ड नोटिस", 
      "बिहार बोर्ड नई सूचना", "बिहार बोर्ड लेटेस्ट न्यूज़", "बिहार शिक्षा विभाग", "बिहार शिक्षा विभाग की नई सूचना", "बिहार शिक्षक न्यूज़", "बिहार स्कूल न्यूज़", "बिहार सरकारी स्कूल", 
      "बिहार छात्रवृत्ति", "बिहार बोर्ड", "Education Minister Bihar", "Mithilesh Tiwari Bihar",
    ];

    while ((match = itemRegex.exec(xmlText)) !== null) {
      const itemContent = match[1];

      const getTagValue = (tag) => {
        const tagMatch = itemContent.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
        return tagMatch ? tagMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim() : '';
      };

      const title = getTagValue('title');
      const link = getTagValue('link');
      const pubDate = getTagValue('pubDate');
      const rawDescription = getTagValue('description');
      const source = getTagValue('source') || 'News Source';

      // 5. Clean HTML tags and decode &nbsp; on the server
      const cleanDescription = rawDescription
        .replace(/<[^>]*>?/gm, '')         // Strip all HTML tags like <a> and <font>
        .replace(/&nbsp;/g, ' ')           // Replace non-breaking spaces
        .replace(/\s+/g, ' ')              // Normalize whitespace
        .trim();

      // Check if title or cleaned description contains our target keywords
      const fullText = (title + ' ' + cleanDescription).toLowerCase();
      const isRelevant = KEYWORDS.some(k => fullText.includes(k));

      if (isRelevant && title) {
        items.push({
          title,
          description: cleanDescription,
          url: link,
          publishedAt: pubDate,
          source
        });
      }
    }

    return res.status(200).json({
      status: 'ok',
      totalResults: items.length,
      articles: items
    });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch news feed',
      articles: []
    });
  }
}
