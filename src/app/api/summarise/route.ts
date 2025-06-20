import { groq } from "@ai-sdk/groq";
import { generateText } from "ai";
import { NextRequest, NextResponse } from "next/server";

function detectSource(content: string): "vnexpress" | "nytimes" | "unknown" {
  if (
    content.includes("vnexpress.net") ||
    content.includes('class="main_fck_detail"')
  ) {
    return "vnexpress";
  }
  if (content.includes("nytimes.com") || content.includes("nyt-a-")) {
    return "nytimes";
  }
  return "unknown";
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key not configured" },
        { status: 500 }
      );
    }

    if (apiKey === "your_groq_api_key_here") {
      return NextResponse.json(
        { error: "Please configure a valid API key" },
        { status: 500 }
      );
    }

    if (!apiKey.startsWith("gsk_")) {
      return NextResponse.json(
        { error: "Invalid API key format" },
        { status: 500 }
      );
    }

    const { content } = await request.json();

    if (!content) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    const source = detectSource(content);

    const maxContentLength = 16000;
    const truncatedContent =
      content.length > maxContentLength
        ? content.substring(0, maxContentLength) + "..."
        : content;

    let prompt = "";
    if (source === "vnexpress") {
      prompt = `Hãy tóm tắt bài viết VNExpress sau đây bằng tiếng Việt. Tóm tắt cần:
- Chi tiết và đầy đủ thông tin quan trọng
- Giữ lại tất cả con số, thống kê, tên riêng
- Bao gồm nguyên nhân, diễn biến và hệ quả
- Độ dài từ 150-300 từ
- Chia thành các đoạn rõ ràng
- Sử dụng ngôn ngữ chính xác, dễ hiểu

Nội dung bài viết:
${truncatedContent}

Tóm tắt:`;
    } else if (source === "nytimes") {
      prompt = `Please summarize the following New York Times article in Vietnamese. The summary should:
- Be concise but include all main information
- Retain important numbers and statistics
- Include key points and conclusions
- Be approximately 150-300 words
- Use clear and understandable language
- Maintain the journalistic style of the New York Times

Article content:
${truncatedContent}

Summary (in Vietnamese):`;
    } else {
      prompt = `Hãy tóm tắt bài báo sau đây bằng tiếng Việt. Tóm tắt cần:
- Ngắn gọn nhưng đầy đủ thông tin chính
- Giữ lại các con số, thống kê quan trọng
- Bao gồm các điểm chính và kết luận
- Độ dài khoảng 150-300 từ
- Sử dụng ngôn ngữ rõ ràng, dễ hiểu
- Giữ lại phong cách báo chí chuyên nghiệp

Nội dung bài viết:
${truncatedContent}

Tóm tắt:`;
    }

    const { text } = await generateText({
      model: groq("llama-3.3-70b-versatile"),
      prompt: prompt,
      maxTokens: 2000,
      temperature: 0.3,
    });

    const cleanedSummary = text
      .replace(/^Tóm tắt:\s*/i, "")
      .replace(/^Summary.*?:\s*/i, "")
      .replace(/^\s*-\s*/, "")
      .trim();

    return NextResponse.json({
      summary: cleanedSummary,
      source: source,
      originalLength: content.length,
      summaryLength: cleanedSummary.length,
    });
  } catch (error: unknown) {
    if (
      (error as Error).message?.includes("API key") ||
      (error &&
        typeof error === "object" &&
        "responseBody" in error &&
        typeof (error as { responseBody: unknown }).responseBody === "string" &&
        (error as { responseBody: string }).responseBody.includes(
          "invalid_api_key"
        ))
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid API key. Please check your Groq API key configuration.",
        },
        { status: 401 }
      );
    }

    if ((error as Error).message?.includes("rate limit")) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429 }
      );
    }

    if (
      (error as Error).message?.includes("context length") ||
      (error as Error).message?.includes("token")
    ) {
      return NextResponse.json(
        { error: "Article is too long. Please try with a shorter article." },
        { status: 400 }
      );
    }

    if (
      (error as Error).message?.includes("model") &&
      (error as Error).message?.includes("decommissioned")
    ) {
      return NextResponse.json(
        {
          error: "Model is no longer supported. Please update the application.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to summarize content",
        details: (error as Error).message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
