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
    const searchQuery = encodeURIComponent('"Bihar Board" OR "BSEB" OR "बिहार बोर्ड" OR "OFSS Bihar"');
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
