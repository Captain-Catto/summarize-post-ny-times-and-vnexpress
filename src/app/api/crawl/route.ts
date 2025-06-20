import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

interface ArticleData {
  source: "vnexpress" | "vnexpress-en" | "nytimes";
  title: string;
  author: string;
  date: string;
  content: string;
  tags: string[];
  rawHtml?: string;
}

function parseVNExpress($: cheerio.CheerioAPI): ArticleData {
  const title = $(".title_post").text().trim() || $("h1").first().text().trim();

  const authorElement = $(".author");
  let author = "";
  let date = "";

  if (authorElement.length) {
    const authorText = authorElement.text();
    const authorMatch = authorText.match(/By\s+(.+?)\s+/);
    author = authorMatch ? authorMatch[1] : "";

    const dateMatch = authorText.match(/(\w+\s+\d+,\s+\d+)/);
    date = dateMatch ? dateMatch[1] : "";
  }

  const lead = $(".lead_post_detail").text().trim();

  const contentParagraphs = $(".fck_detail p.Normal");
  const content = contentParagraphs
    .map((_, el) => $(el).text().trim())
    .get()
    .filter((text) => text.length > 0)
    .join("\n\n");

  const tags = $(".tag_item a")
    .map((_, el) => $(el).text().trim())
    .get();

  return {
    source: "vnexpress",
    title,
    author,
    date,
    content: lead + "\n\n" + content,
    tags,
  };
}

function parseVNExpressEnglish($: cheerio.CheerioAPI): ArticleData {
  const title =
    $(".title_news_detail").text().trim() ||
    $(".title-detail").text().trim() ||
    $("h1").first().text().trim();

  // Try multiple selectors for author and date
  let author = "";
  let date = "";

  // Check for author in byline
  const bylineElement = $(".byline, .author-info, .article-author");
  if (bylineElement.length) {
    const bylineText = bylineElement.text();
    const authorMatch = bylineText.match(/By\s+(.+?)(?:\s+\||$)/i);
    author = authorMatch ? authorMatch[1].trim() : "";
  }

  // Check for date
  const dateElement = $(".date, .article-date, .publish-date, time");
  if (dateElement.length) {
    date = dateElement.first().text().trim();
  }

  // Try to get date from datetime attribute
  if (!date) {
    const timeElement = $("time");
    date = timeElement.attr("datetime") || timeElement.text().trim();
  }

  // Get lead/summary
  const lead = $(".lead, .summary, .article-summary").text().trim();

  // Get main content
  const contentSelectors = [
    ".fck_detail p",
    ".article-content p",
    ".content-detail p",
    ".Normal",
  ];

  let content = "";
  for (const selector of contentSelectors) {
    const paragraphs = $(selector);
    if (paragraphs.length > 0) {
      content = paragraphs
        .map((_, el) => $(el).text().trim())
        .get()
        .filter((text) => text.length > 0)
        .join("\n\n");
      break;
    }
  }

  // Get tags
  const tags = $(".tag_item a, .tags a, .article-tags a")
    .map((_, el) => $(el).text().trim())
    .get();

  return {
    source: "vnexpress-en",
    title,
    author,
    date,
    content: lead ? `${lead}\n\n${content}` : content,
    tags,
  };
}

function parseNYTimes($: cheerio.CheerioAPI): ArticleData {
  const articleData: Partial<ArticleData> = {
    source: "nytimes",
    title: "",
    author: "",
    date: "",
    content: "",
    tags: [],
  };

  // Try to extract data from JSON-LD scripts first
  const jsonLdScripts = $('script[type="application/ld+json"]');

  jsonLdScripts.each((_, element) => {
    try {
      const jsonText = $(element).html();
      if (jsonText) {
        const jsonData = JSON.parse(jsonText);

        // Look for NewsArticle type
        if (jsonData["@type"] === "NewsArticle") {
          if (jsonData.headline && !articleData.title) {
            articleData.title = jsonData.headline;
          }

          if (jsonData.author && !articleData.author) {
            if (Array.isArray(jsonData.author)) {
              articleData.author = jsonData.author
                .map((a: { name?: string } | string) =>
                  typeof a === "object" && a.name ? a.name : String(a)
                )
                .join(", ");
            } else {
              articleData.author = jsonData.author.name || jsonData.author;
            }
          }

          if (jsonData.datePublished && !articleData.date) {
            articleData.date = new Date(
              jsonData.datePublished
            ).toLocaleDateString();
          }

          if (jsonData.articleBody && !articleData.content) {
            articleData.content = jsonData.articleBody;
          }

          if (jsonData.keywords && articleData.tags?.length === 0) {
            if (Array.isArray(jsonData.keywords)) {
              articleData.tags = jsonData.keywords;
            } else if (typeof jsonData.keywords === "string") {
              articleData.tags = (jsonData.keywords as string)
                .split(",")
                .map((k: string) => k.trim());
            }
          }
        }
      }
    } catch {
      // Continue if JSON parsing fails
    }
  });

  // Fallback to HTML parsing if JSON-LD didn't provide all data
  if (!articleData.title) {
    articleData.title =
      $('[data-testid="headline"]').text().trim() ||
      $('h1[data-test-id="headline"]').text().trim() ||
      $("h1").first().text().trim() ||
      $('meta[property="og:title"]').attr("content") ||
      $("title").text().trim();
  }

  if (!articleData.author) {
    const authorElements = $('[data-testid="byline-author"], [rel="author"]');
    articleData.author = authorElements
      .map((_, el) => $(el).text().trim())
      .get()
      .join(", ");
  }

  if (!articleData.date) {
    const dateElement = $('time, [data-testid="timestamp"]');
    articleData.date =
      dateElement.attr("datetime") || dateElement.text().trim();

    // Try meta tags
    if (!articleData.date) {
      articleData.date =
        $('meta[property="article:published_time"]').attr("content") ||
        $('meta[name="pubdate"]').attr("content") ||
        "";
    }
  }

  if (!articleData.content) {
    // Try to get lead/summary first
    const lead = $('[data-testid="summary"], .summary').text().trim();

    // Try multiple content selectors
    const contentSelectors = [
      '[data-testid="story-content"] p',
      ".StoryBodyCompanionColumn p",
      ".ArticleBody p",
      'section[name="articleBody"] p',
      ".css-1fanzo5 p", // NYT specific class
      ".StoryBodyCompanionColumn div > p",
    ];

    let content = "";
    for (const selector of contentSelectors) {
      const paragraphs = $(selector);
      if (paragraphs.length > 0) {
        content = paragraphs
          .map((_, el) => $(el).text().trim())
          .get()
          .filter(
            (text) => text.length > 0 && !text.startsWith("Advertisement")
          )
          .join("\n\n");
        break;
      }
    }

    // If still no content, try to get from meta description
    if (!content) {
      content =
        $('meta[name="description"]').attr("content") ||
        $('meta[property="og:description"]').attr("content") ||
        "";
    }

    // Enhanced paywall and unwanted content filtering
    const unwantedPatterns = [
      // Paywall messages
      /Thank you for your patience while we verify access\./gi,
      /If you are in Reader mode please exit and log into your Times account, or subscribe for all of The Times\./gi,
      /Already a subscriber\?\s*Log in\./gi,
      /Want all of The Times\?\s*Subscribe\./gi,
      /Subscribe for full access to The Times\./gi,
      /Log in to continue reading\./gi,
      /This article is for subscribers only\./gi,
      /You have reached your limit of free articles\./gi,
      /Create a free account or log in to continue reading\./gi,
      /Sign up to continue reading\./gi,

      // Navigation and UI text
      /Continue reading the main story/gi,
      /Advertisement/gi,
      /^Supported by$/gi,
      /Continue reading$/gi,
      /Read more$/gi,
      /Show more$/gi,
      /Hide$/gi,

      // Social and sharing
      /Share this article/gi,
      /Follow us on/gi,
      /Subscribe to our newsletter/gi,
      /Download the app/gi,

      // Comments and interaction
      /^\d+\s*comments?$/gi,
      /Share your thoughts/gi,
      /What do you think\?/gi,

      // Common footer text
      /Times subscribers can gift articles/gi,
      /Give this article as a gift/gi,
      /A version of this article appears in print/gi,
    ];

    // Clean the content - apply each pattern
    let cleanedContent = content;
    unwantedPatterns.forEach((pattern) => {
      cleanedContent = cleanedContent.replace(pattern, "");
    });

    // Additional cleaning for common paywall sentence structures
    const paywallSentencePatterns = [
      // Remove sentences that contain paywall keywords
      /[^.!?]*(?:subscriber|subscription|log in|sign up|paywall|free articles)[^.!?]*[.!?]/gi,
      /[^.!?]*(?:Reader mode|Times account|full access)[^.!?]*[.!?]/gi,
      /[^.!?]*(?:Create a free account|Sign up to continue)[^.!?]*[.!?]/gi,
    ];

    paywallSentencePatterns.forEach((pattern) => {
      cleanedContent = cleanedContent.replace(pattern, "");
    });

    // Remove multiple consecutive newlines and trim
    cleanedContent = cleanedContent.replace(/\n{3,}/g, "\n\n").trim();

    // Remove empty lines and clean up spacing
    cleanedContent = cleanedContent
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join("\n\n");

    // Final check - if content is too short after cleaning, it might be mostly paywall
    if (cleanedContent.length < 200 && content.length > 500) {
      // Try to extract from JSON-LD or meta tags as fallback
      const jsonLdScripts = $('script[type="application/ld+json"]');
      let fallbackContent = "";

      jsonLdScripts.each((_, element) => {
        try {
          const jsonText = $(element).html();
          if (jsonText) {
            const jsonData = JSON.parse(jsonText);
            if (jsonData["@type"] === "NewsArticle" && jsonData.articleBody) {
              fallbackContent = jsonData.articleBody;
              return false; // Break the loop
            }
          }
        } catch {
          // Continue if JSON parsing fails
        }
      });

      if (fallbackContent && fallbackContent.length > cleanedContent.length) {
        cleanedContent = fallbackContent;
      }
    }

    articleData.content = lead
      ? `${lead}\n\n${cleanedContent}`
      : cleanedContent;
  }

  if (!articleData.tags || articleData.tags.length === 0) {
    articleData.tags = $('[data-testid="tags"] a, .tags a')
      .map((_, el) => $(el).text().trim())
      .get();
  }

  return articleData as ArticleData;
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: `Failed to fetch article: ${response.status} ${response.statusText}`,
        },
        { status: 400 }
      );
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    let articleData: ArticleData;

    if (
      url.includes("vnexpress.net") ||
      html.includes('class="main_fck_detail"')
    ) {
      // Check if it's English VNExpress
      if (url.includes("e.vnexpress.net")) {
        articleData = parseVNExpressEnglish($);
      } else {
        articleData = parseVNExpress($);
      }
    } else if (url.includes("nytimes.com") || html.includes("nyt-a-")) {
      articleData = parseNYTimes($);
    } else {
      return NextResponse.json(
        {
          error:
            "Unsupported news source. Only VNExpress (VN/EN) and New York Times are supported.",
        },
        { status: 400 }
      );
    }

    // Validate that we got some content
    if (!articleData.title && !articleData.content) {
      return NextResponse.json(
        {
          error:
            "Could not extract article content. The page might be behind a paywall or use dynamic loading.",
        },
        { status: 400 }
      );
    }

    articleData.rawHtml = html;

    return NextResponse.json(articleData);
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: "Failed to crawl article",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
