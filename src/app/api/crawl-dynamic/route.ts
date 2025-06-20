import { NextRequest, NextResponse } from "next/server";
import { JSDOM } from "jsdom";

interface ArticleData {
  source: "vnexpress" | "nytimes";
  title: string;
  author: string;
  date: string;
  content: string;
  tags: string[];
}

function extractFromJSDOM(dom: JSDOM): ArticleData {
  const document = dom.window.document;

  // Extract from JSON-LD
  const jsonLdScripts = document.querySelectorAll(
    'script[type="application/ld+json"]'
  );
  const articleData: Partial<ArticleData> = {
    source: "nytimes",
    title: "",
    author: "",
    date: "",
    content: "",
    tags: [],
  };

  for (const script of jsonLdScripts) {
    try {
      const jsonData = JSON.parse(script.textContent || "");

      if (jsonData["@type"] === "NewsArticle") {
        if (jsonData.headline) articleData.title = jsonData.headline;
        if (jsonData.author) {
          if (Array.isArray(jsonData.author)) {
            articleData.author = jsonData.author
              .map((a: { name?: string } | string) =>
                typeof a === "object" && a.name ? a.name : a
              )
              .join(", ");
          } else {
            articleData.author = jsonData.author.name || jsonData.author;
          }
        }
        if (jsonData.datePublished) {
          articleData.date = new Date(
            jsonData.datePublished
          ).toLocaleDateString();
        }
        if (jsonData.articleBody) {
          articleData.content = jsonData.articleBody;
        }
        if (jsonData.keywords) {
          if (Array.isArray(jsonData.keywords)) {
            articleData.tags = jsonData.keywords;
          } else if (typeof jsonData.keywords === "string") {
            articleData.tags = (jsonData.keywords as string)
              .split(",")
              .map((k: string) => k.trim());
          }
        }
        break;
      }
    } catch {
      continue;
    }
  }

  // Fallback to meta tags and selectors
  if (!articleData.title) {
    articleData.title =
      document
        .querySelector('meta[property="og:title"]')
        ?.getAttribute("content") ||
      document.querySelector("title")?.textContent ||
      document.querySelector("h1")?.textContent ||
      "";
  }

  if (!articleData.content) {
    articleData.content =
      document
        .querySelector('meta[property="og:description"]')
        ?.getAttribute("content") ||
      document
        .querySelector('meta[name="description"]')
        ?.getAttribute("content") ||
      "";
  }

  if (!articleData.author) {
    const authorMeta = document
      .querySelector('meta[name="author"]')
      ?.getAttribute("content");
    if (authorMeta) articleData.author = authorMeta;
  }

  if (!articleData.date) {
    const dateMeta = document
      .querySelector('meta[property="article:published_time"]')
      ?.getAttribute("content");
    if (dateMeta) articleData.date = new Date(dateMeta).toLocaleDateString();
  }

  return articleData as ArticleData;
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || !url.includes("nytimes.com")) {
      return NextResponse.json(
        { error: "This endpoint is only for NYTimes URLs" },
        { status: 400 }
      );
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch: ${response.status}` },
        { status: 400 }
      );
    }

    const html = await response.text();

    // Use JSDOM to parse the HTML
    const dom = new JSDOM(html, {
      url: url,
      resources: "usable",
      runScripts: "outside-only",
    });

    const articleData = extractFromJSDOM(dom);

    if (!articleData.title && !articleData.content) {
      return NextResponse.json(
        { error: "Could not extract article data" },
        { status: 400 }
      );
    }

    return NextResponse.json(articleData);
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: "Failed to process article",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
