// Vercel Serverless Function for BSEBWala.in
// GET /api/news?category=all&limit=20

const FEEDS = {
  all: 'https://news.google.com/rss/search?q=Bihar+Board+OR+BSEB+OR+Bihar+Education+Department&hl=en-IN&gl=IN&ceid=IN:en',
  bseb: 'https://news.google.com/rss/search?q=Bihar+Board+OR+BSEB&hl=en-IN&gl=IN&ceid=IN:en',
  education: 'https://news.google.com/rss/search?q=Bihar+Education+Department+OR+Bihar+School+Education&hl=en-IN&gl=IN&ceid=IN:en',
  matric: 'https://news.google.com/rss/search?q=Bihar+Board+10th+OR+Bihar+Matric&hl=en-IN&gl=IN&ceid=IN:en',
  inter: 'https://news.google.com/rss/search?q=Bihar+Board+12th+OR+Bihar+Intermediate&hl=en-IN&gl=IN&ceid=IN:en',
  teacher: 'https://news.google.com/rss/search?q=Bihar+Teacher+OR+Bihar+Teachers+Education&hl=en-IN&gl=IN&ceid=IN:en'
};

function cleanHtml(s = '') {
  return s.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
}

function getTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? cleanHtml(m[1]) : '';
}

function getItems(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(m => m[1]);
}

function parseItem(item) {
  const title = getTag(item, 'title');
  const link = getTag(item, 'link');
  const pubDate = getTag(item, 'pubDate');
  const description = getTag(item, 'description');
  const source = getTag(item, 'source');
  return { title, link, source, description, pubDate };
}

module.exports = async (req, res) => {
  const category = String(req.query.category || 'all').toLowerCase();
  const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 50);
  const feed = FEEDS[category] || FEEDS.all;

  try {
    const response = await fetch(feed, { headers: { 'User-Agent': 'BSEBWala-News/1.0' } });
    if (!response.ok) throw new Error(`Feed returned ${response.status}`);
    const xml = await response.text();

    const articles = getItems(xml)
      .map(parseItem)
      .filter(x => x.title && x.link)
      .slice(0, limit)
      .map((x, i) => ({
        id: `${category}-${i}-${Buffer.from(x.link).toString('base64url').slice(0, 12)}`,
        title: x.title,
        source: x.source || 'News source',
        description: x.description,
        url: x.link,
        publishedAt: x.pubDate,
        category
      }));

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(200).json({
      success: true,
      site: 'BSEBWala.in',
      category,
      count: articles.length,
      updatedAt: new Date().toISOString(),
      articles
    });
  } catch (error) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(502).json({ success: false, error: 'Unable to fetch news right now', details: error.message });
  }
};
