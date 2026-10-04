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

  // 2. Cache response on Vercel's Edge CDN for 5 minutes
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  try {
    // 3. Cast a wide net: Group broad search terms into 3 RSS URLs to avoid hitting query length limits
    const FEEDS = [
      // Board, Students & Exams
      `https://news.google.com/rss/search?q=${encodeURIComponent('BSEB OR "Bihar Board" OR "बिहार बोर्ड" OR matric OR inter OR OFSS OR BBOSE')}&hl=en-IN&gl=IN&ceid=IN:en`,
      // Teachers & Recruitment
      `https://news.google.com/rss/search?q=${encodeURIComponent('"Bihar teacher" OR "BPSC TRE" OR STET OR sakshamta OR "niyojit teacher"')}&hl=en-IN&gl=IN&ceid=IN:en`,
      // Dept, Ministers & Scholarships
      `https://news.google.com/rss/search?q=${encodeURIComponent('medhasoft OR scholarship OR "Mithilesh tiwari" OR "shiksha vibhag"')}&hl=en-IN&gl=IN&ceid=IN:en`
    ];

    // Fetch all RSS feeds concurrently
    const fetchPromises = FEEDS.map(url =>
      fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      }).then(res => res.ok ? res.text() : '')
    );

    const xmlTexts = await Promise.all(fetchPromises);

    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    const items = [];
    const seenUrls = new Set(); // Prevent duplicate articles

    // 4. Strict Filtering: Your exact requested list of keywords
    const KEYWORDS = [
      "bihar board", "bseb", "matric", "inter", "ofss", "bbose", 
      "shiksha vibhag", "education department", "bihar teacher", "bpsc tre", 
      "scholarship", "medhasoft", "digilocker", "stet", "sakshamta", 
      "admit card", "result", "scrutiny", "compartment", "syllabus", 
      "model paper", "dummy registration", "बिहार बोर्ड", "bpsc teacher",
      "bihar board class 9 registration", "bihar board class 11 registration",
      "bihar board class 10 exam form", "bihar board class 12 exam form", "tre teacher",
      "niyojit teacher", "bihar education", "mithilesh tiwari minister", "bihar education minister"
    ];

    // Loop through every fetched RSS feed
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

        // Skip if we already added this URL
        if (seenUrls.has(link)) continue;

        // Clean HTML tags and decode entities for plain text
        const cleanDescription = rawDescription
          .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
          .replace(/<[^>]*>?/gm, '')
          .replace(/&nbsp;/gi, ' ')
          .replace(/&quot;/gi, '"')
          .replace(/&#39;/gi, "'")
          .replace(/\s+/g, ' ')
          .trim();

        const fullText = (title + ' ' + cleanDescription).toLowerCase();
        
        // Check if the article contains ANY of your specific keywords
        const isRelevant = KEYWORDS.some(k => fullText.includes(k.toLowerCase()));

        if (isRelevant && title) {
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

    // 5. Sort all combined items by Date (Newest first)
    items.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

    // Return the successful data
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
