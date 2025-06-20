import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

interface ArticleLink {
  title: string;
  url: string;
  summary?: string;
  publishDate?: string;
  author?: string;
}

function extractVNExpressLinks($: cheerio.CheerioAPI): ArticleLink[] {
  const links: ArticleLink[] = [];

  // Main article selectors for VNExpress
  const selectors = [
    ".title_news a",
    ".title_news_list a",
    ".item_news_common .title_news a",
    ".item-news .title_news a",
    ".item-news-common .title_news a",
    ".box-subcategory .title_news a",
    "h3.title_news a",
    "h2.title_news a",
    ".item-news h3 a",
    ".list_news .item-news .title_news a",
  ];

  selectors.forEach((selector) => {
    $(selector).each((_, element) => {
      const $el = $(element);
      const href = $el.attr("href");
      const title = $el.text().trim();

      if (href && title && href.includes(".html")) {
        const fullUrl = href.startsWith("http")
          ? href
          : `https://vnexpress.net${href}`;

        // Check if already exists
        if (!links.find((link) => link.url === fullUrl)) {
          // Try to get summary from parent element
          const summary = $el
            .closest(".item-news, .item_news_common, .box-subcategory")
            .find(".description, .summary_news, .lead_post_detail")
            .text()
            .trim();

          links.push({
            title,
            url: fullUrl,
            summary: summary || undefined,
          });
        }
      }
    });
  });

  return links;
}

function extractVNExpressEnglishLinks(
  $: cheerio.CheerioAPI,
  baseUrl: string
): ArticleLink[] {
  const links: ArticleLink[] = [];

  // Updated selectors based on actual VNExpress English HTML structure
  const selectors = [
    // Main article title links
    ".title_news_site a",
    "h4.title_news_site a",
    ".title_news a",
    "h3.title_news a",
    "h2.title_news a",
    // Alternative patterns
    ".item_news .title_news_site a",
    ".item_news h4 a",
    ".item_list_folder .title_news_site a",
    // Generic article patterns
    "a[href*='.html']",
  ];

  console.log("Extracting VNExpress English links from:", baseUrl);

  selectors.forEach((selector, index) => {
    const elements = $(selector);
    console.log(
      `Selector ${index + 1} (${selector}): found ${elements.length} elements`
    );

    elements.each((_, element) => {
      const $el = $(element);
      const href = $el.attr("href");
      let title = $el.text().trim();

      // Clean up title
      title = title.replace(/\s+/g, " ").trim();

      if (href && title && title.length > 10) {
        // Check if it's a valid article URL
        const isValidArticle =
          href.includes(".html") &&
          href.includes("e.vnexpress.net") &&
          !href.includes("javascript:") &&
          !href.includes("mailto:");

        if (isValidArticle) {
          let fullUrl = href;

          // Handle relative URLs
          if (href.startsWith("/")) {
            fullUrl = `https://e.vnexpress.net${href}`;
          } else if (!href.startsWith("http")) {
            fullUrl = `https://e.vnexpress.net/${href}`;
          }

          // Check if already exists
          if (!links.find((link) => link.url === fullUrl)) {
            // Try to get summary from lead_news_site
            let summary = "";

            // Look for summary in the same item container
            const itemContainer = $el.closest(".item_news, .item_list_folder");
            if (itemContainer.length) {
              summary = itemContainer
                .find(".lead_news_site a")
                .first()
                .text()
                .trim();
              // Clean up summary - remove the nested link text
              if (summary) {
                summary = summary.replace(/\s+/g, " ").trim();
                // Remove any trailing comment indicators
                summary = summary.replace(/\s*\d+\s*$/, "").trim();
              }
            }

            console.log(`Found article: ${title} -> ${fullUrl}`);
            if (summary) {
              console.log(`Summary: ${summary.substring(0, 100)}...`);
            }

            links.push({
              title,
              url: fullUrl,
              summary: summary || undefined,
            });
          }
        }
      }
    });
  });

  // If no links found with specific selectors, try a more general approach
  if (links.length === 0) {
    console.log(
      "No links found with specific selectors, trying general approach..."
    );

    $("a").each((_, element) => {
      const $el = $(element);
      const href = $el.attr("href");
      const title = $el.text().trim();

      if (href && title && title.length > 10) {
        // Check if it looks like an article URL
        if (
          href.includes(".html") &&
          href.includes("e.vnexpress.net") &&
          !href.includes("javascript:") &&
          !href.includes("mailto:") &&
          !href.includes("tel:")
        ) {
          let fullUrl = href;

          if (href.startsWith("/")) {
            fullUrl = `https://e.vnexpress.net${href}`;
          } else if (!href.startsWith("http")) {
            fullUrl = `https://e.vnexpress.net/${href}`;
          }

          // Filter out navigation and non-article links
          const excludePatterns = [
            "rss",
            "contact",
            "about",
            "policy",
            "terms",
            "subscribe",
            "login",
            "register",
            "search",
            "category",
            "tag",
          ];

          const shouldExclude = excludePatterns.some(
            (pattern) =>
              fullUrl.toLowerCase().includes(pattern) ||
              title.toLowerCase().includes(pattern)
          );

          if (!shouldExclude && !links.find((link) => link.url === fullUrl)) {
            console.log(`General approach found: ${title} -> ${fullUrl}`);
            links.push({
              title,
              url: fullUrl,
            });
          }
        }
      }
    });
  }

  console.log(`Total links extracted: ${links.length}`);
  return links;
}

function extractNYTimesLinks($: cheerio.CheerioAPI): ArticleLink[] {
  const links: ArticleLink[] = [];

  // NYTimes article selectors
  const selectors = [
    'a[data-testid="headline-link"]',
    ".css-1l4spti a",
    ".css-8hzhxf a",
    'h3 a[href*="/"]',
    'h2 a[href*="/"]',
    ".story-wrapper a",
    "article a",
    ".promo-wrapper a",
  ];

  selectors.forEach((selector) => {
    $(selector).each((_, element) => {
      const $el = $(element);
      const href = $el.attr("href");
      let title = $el.text().trim();

      // If no text in link, try to find title in parent
      if (!title) {
        title =
          $el.find("h1, h2, h3, h4").text().trim() ||
          $el
            .closest("article, .story-wrapper")
            .find("h1, h2, h3, h4")
            .first()
            .text()
            .trim();
      }

      if (href && title && href.includes("/2")) {
        // NYT articles usually have year in URL
        const fullUrl = href.startsWith("http")
          ? href
          : `https://www.nytimes.com${href}`;

        // Check if already exists and is not homepage
        if (
          !links.find((link) => link.url === fullUrl) &&
          !fullUrl.endsWith("nytimes.com/")
        ) {
          // Try to get summary
          const summary = $el
            .closest("article, .story-wrapper, .promo-wrapper")
            .find('p, .summary, [data-testid="summary"]')
            .first()
            .text()
            .trim();

          links.push({
            title,
            url: fullUrl,
            summary: summary || undefined,
          });
        }
      }
    });
  });

  return links;
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    console.log("Crawling links from:", url);

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        Connection: "keep-alive",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch page: ${response.status}` },
        { status: 400 }
      );
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Log some HTML structure for debugging
    console.log("Page title:", $("title").text());
    console.log("Number of links on page:", $("a").length);

    let links: ArticleLink[] = [];

    if (url.includes("vnexpress.net")) {
      if (url.includes("e.vnexpress.net")) {
        links = extractVNExpressEnglishLinks($, url);
      } else {
        links = extractVNExpressLinks($);
      }
      links = extractNYTimesLinks($);
    } else {
      return NextResponse.json(
        {
          error:
            "Unsupported news source. Only VNExpress (VN/EN) and New York Times are supported.",
        },
        { status: 400 }
      );
    }

    // Filter out duplicates and invalid links
    const uniqueLinks = links.filter(
      (link, index, self) =>
        index === self.findIndex((l) => l.url === link.url) &&
        link.title.length > 10 // Filter out short titles
    );

    // Limit to reasonable number
    const limitedLinks = uniqueLinks.slice(0, 50);

    console.log(`Returning ${limitedLinks.length} unique links`);

    return NextResponse.json({
      source: url.includes("e.vnexpress.net")
        ? "vnexpress-en"
        : url.includes("vnexpress.net")
        ? "vnexpress"
        : "nytimes",
      baseUrl: url,
      links: limitedLinks,
      totalFound: limitedLinks.length,
    });
  } catch (error: unknown) {
    console.error("Error crawling links:", error);
    return NextResponse.json(
      {
        error: "Failed to crawl links",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
