export default async function handler(req, res) {
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

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  try {
    // 1. Pre-filtered RSS URLs: Forcing Google to only look for Indian Education
    const FEEDS = [
      // Bihar Board & Exams
      `https://news.google.com/rss/search?q=${encodeURIComponent('(BSEB OR "Bihar Board" OR matric OR inter OR OFSS OR BBOSE) (Bihar OR India)')}&hl=en-IN&gl=IN&ceid=IN:en`,
      // Teachers & Recruitment
      `https://news.google.com/rss/search?q=${encodeURIComponent('("Bihar teacher" OR "BPSC TRE" OR STET OR sakshamta OR "niyojit teacher") (Education OR School)')}&hl=en-IN&gl=IN&ceid=IN:en`,
      // Dept, Scholarships & General Indian Education (CBSE, UGC, NTA)
      `https://news.google.com/rss/search?q=${encodeURIComponent('(medhasoft OR scholarship OR "shiksha vibhag" OR CBSE OR ICSE OR EXAM OR "Education Ministry") India')}&hl=en-IN&gl=IN&ceid=IN:en`
    ];

    const fetchPromises = FEEDS.map(url =>
      fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }).then(res => res.ok ? res.text() : '')
    );

    const xmlTexts = await Promise.all(fetchPromises);

    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    const items = [];
    const seenUrls = new Set(); 

    // 2. Strict Filtering Arrays
    const INDIA_REGION_WORDS = [
      "india", "indian", "bharat", "bihar", "patna", "national", "state", "delhi", "central"
    ];

    const EDUCATION_WORDS = [
      "education", "school", "exam", "board", "teacher", "student", "university", "college", 
      "syllabus", "shiksha", "result", "admit card", "scholarship", "academic", "class"
    ];

    const EXACT_ACRONYMS = [
      "bihar board", "bseb", "bpsc tre", "stet", "ofss", "bbose", "medhasoft", 
      "cbse", "ugc", "nta", "neet", "jee", "ncert", "sakshamta"
    ];

    for (const xmlText of xmlTexts) {
      if (!xmlText) continue;
      
      let match;
      while ((match = itemRegex.exec(xmlText)) !== null) {
        const itemContent = match[1];

        const getTagValue = (tag) => {
          const tagMatch = itemContent.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
          return tagMatch ? tagMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1').trim() : '';
        };

        const title = getTagValue('title');
        const link = getTagValue('link');
        const pubDate = getTagValue('pubDate');
        const rawDescription = getTagValue('description');
        const source = getTagValue('source') || 'News Source';

        if (seenUrls.has(link)) continue;

        const cleanDescription = rawDescription
          .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
          .replace(/<[^>]*>?/gm, '')
          .replace(/&nbsp;/gi, ' ')
          .replace(/&quot;/gi, '"')
          .replace(/&#39;/gi, "'")
          .replace(/\s+/g, ' ')
          .trim();

        const fullText = (title + ' ' + cleanDescription).toLowerCase();
        
        // Double-Lock Validation Logic:
        // A. Does it have an explicit exact acronym? (e.g., BSEB, CBSE, BPSC TRE)
        const hasExactAcronym = EXACT_ACRONYMS.some(k => fullText.includes(k));

        // B. Or does it explicitly mention BOTH India/Bihar AND Education context?
        const hasRegion = INDIA_REGION_WORDS.some(k => fullText.includes(k));
        const hasEducation = EDUCATION_WORDS.some(k => fullText.includes(k));
        
        // If it passes either A or B, it is guaranteed to be Indian Education news.
        const isStrictlyIndianEducation = hasExactAcronym || (hasRegion && hasEducation);

        // C. Ensure we don't accidentally pick up unrelated sports or stock market news sharing acronyms
        const isNotJunk = !fullText.match(/cricket|bcci|stock market|sensex|nifty|bollywood|hollywood/);

        if (isStrictlyIndianEducation && isNotJunk && title) {
          seenUrls.add(link);
          items.push({
            title,
            description: cleanDescription,
            url: link,
            publishedAt: pubDate,
            source
          });
        }
      }
    }

    items.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

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
