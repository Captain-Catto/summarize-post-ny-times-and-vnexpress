import { groq } from "@ai-sdk/groq";
import { generateText } from "ai";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key not configured" },
        { status: 500 }
      );
    }

    const { content, sourceLanguage, targetLanguage } = await request.json();

    if (!content) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    const maxContentLength = 8000;
    const truncatedContent =
      content.length > maxContentLength
        ? content.substring(0, maxContentLength) + "..."
        : content;

    let prompt = "";

    if (sourceLanguage === "en" && targetLanguage === "vi") {
      prompt = `Translate the following English article to Vietnamese. Make the translation natural and fluent while preserving all important information, numbers, and proper nouns. Use Vietnamese journalistic style.

English content:
${truncatedContent}

Vietnamese translation:`;
    } else if (sourceLanguage === "vi" && targetLanguage === "en") {
      prompt = `Translate the following Vietnamese article to English. Make the translation natural and fluent while preserving all important information, numbers, and proper nouns. Use proper English journalistic style.

Vietnamese content:
${truncatedContent}

English translation:`;
    } else {
      return NextResponse.json(
        {
          error:
            "Unsupported language pair. Only Vietnamese-English and English-Vietnamese are supported.",
        },
        { status: 400 }
      );
    }

    const { text } = await generateText({
      model: groq("llama-3.1-70b-versatile"),
      prompt: prompt,
      maxTokens: 2000,
      temperature: 0.3,
    });

    const cleanedTranslation = text.replace(/^.*?translation:\s*/i, "").trim();

    return NextResponse.json({
      translation: cleanedTranslation,
      sourceLanguage,
      targetLanguage,
      originalLength: content.length,
      translationLength: cleanedTranslation.length,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: "Failed to translate content",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
