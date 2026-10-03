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
    // FIX 1: Simplified the search query so Google News actually returns results
    const searchQuery = encodeURIComponent('Bihar Board BSEB');
    const rssUrl = `https://news.google.com/rss/search?q=${searchQuery}&hl=en-IN&gl=IN&ceid=IN:en`;

    const response = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Upstream RSS request failed: ${response.statusText}`);
    }

    const xmlText = await response.text();

    // Parse Items from XML safely
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    const items = [];
    let match;

    // Strict keyword whitelist to reject any stray political/general news
    const KEYWORDS = [
      "bihar board", "bseb", "matric", "inter", "ofss", "bbose", 
      "shiksha vibhag", "education department", "teacher", "bpsc tre", 
      "scholarship", "medhasoft", "digilocker", "stet", "sakshamta", 
      "admit card", "result", "scrutiny", "compartment", "syllabus", 
      "model paper", "dummy registration", "बिहार बोर्ड"
    ];

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

      // FIX 2: Better HTML entity decoding so descriptions are perfectly clean plain text
      const cleanDescription = rawDescription
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>') // Decode escaped brackets
        .replace(/<[^>]*>?/gm, '')                   // Strip all HTML tags like <a> and <font>
        .replace(/&nbsp;/gi, ' ')                    // Replace non-breaking spaces
        .replace(/&quot;/gi, '"')                    // Fix quotes
        .replace(/&#39;/gi, "'")                     // Fix apostrophes
        .replace(/\s+/g, ' ')                        // Normalize whitespace
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

    // Return the successful, populated array
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
