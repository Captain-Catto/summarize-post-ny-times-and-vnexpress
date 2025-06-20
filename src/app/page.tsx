"use client";

import { useState } from "react";

interface ArticleLink {
  title: string;
  url: string;
  summary?: string;
  publishDate?: string;
  author?: string;
}

interface ArticleData {
  source: "vnexpress" | "vnexpress-en" | "nytimes";
  title: string;
  author: string;
  date: string;
  content: string;
  tags: string[];
}

interface LinkCrawlResult {
  source: "vnexpress" | "nytimes";
  baseUrl: string;
  links: ArticleLink[];
  totalFound: number;
}

// Add new interface for URL options
interface UrlOption {
  label: string;
  url: string;
}

interface UrlCategory {
  name: string;
  color: string;
  options: UrlOption[];
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [linkResult, setLinkResult] = useState<LinkCrawlResult | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<ArticleData | null>(
    null
  );
  const [translation, setTranslation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeStep, setActiveStep] = useState<
    "input" | "links" | "article" | "translation"
  >("input");

  // Add new state for dropdown visibility
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Define URL categories
  const urlCategories: UrlCategory[] = [
    // VNExpress VN - Currently not needed
    // {
    //   name: "VNExpress VN",
    //   color: "red",
    //   options: [
    //     { label: "Trang chủ", url: "https://vnexpress.net/" },
    //     { label: "Thời sự", url: "https://vnexpress.net/thoi-su" },
    //     { label: "Kinh doanh", url: "https://vnexpress.net/kinh-doanh" },
    //     { label: "Công nghệ", url: "https://vnexpress.net/so-hoa" },
    //     { label: "Thể thao", url: "https://vnexpress.net/the-thao" },
    //     { label: "Giải trí", url: "https://vnexpress.net/giai-tri" },
    //   ],
    // },
    {
      name: "VNExpress EN",
      color: "blue",
      options: [
        { label: "Homepage", url: "https://e.vnexpress.net/" },
        { label: "News", url: "https://e.vnexpress.net/news/news" },
        {
          label: "Politics",
          url: "https://e.vnexpress.net/news/news/politics",
        },
        {
          label: "Education",
          url: "https://e.vnexpress.net/news/news/education",
        },
        {
          label: "Environment",
          url: "https://e.vnexpress.net/news/news/environment",
        },
        {
          label: "Traffic",
          url: "https://e.vnexpress.net/news/news/traffic",
        },
        {
          label: "Crime",
          url: "https://e.vnexpress.net/news/news/crime",
        },
        { label: "Tech", url: "https://e.vnexpress.net/news/tech" },
        {
          label: "Tech News",
          url: "https://e.vnexpress.net/news/tech/tech-news",
        },
        {
          label: "Enterprises",
          url: "https://e.vnexpress.net/news/tech/enterprises",
        },
        {
          label: "Personalities",
          url: "https://e.vnexpress.net/news/tech/personalities",
        },
        {
          label: "Vietnam Innovation",
          url: "https://e.vnexpress.net/news/tech/vietnam-innovation",
        },
        { label: "Business", url: "https://e.vnexpress.net/news/business" },
        {
          label: "Data Speaks",
          url: "https://e.vnexpress.net/news/business/data-speaks",
        },
        {
          label: "Property",
          url: "https://e.vnexpress.net/news/business/property",
        },
        {
          label: "Billionaires",
          url: "https://e.vnexpress.net/news/business/billionaires",
        },
        {
          label: "Markets",
          url: "https://e.vnexpress.net/news/business/markets",
        },
        {
          label: "Companies",
          url: "https://e.vnexpress.net/news/business/companies",
        },
        {
          label: "Economy",
          url: "https://e.vnexpress.net/news/business/economy",
        },
      ],
    },
    {
      name: "New York Times",
      color: "gray",
      options: [
        { label: "Homepage", url: "https://www.nytimes.com/" },
        { label: "Business", url: "https://www.nytimes.com/section/business" },
        {
          label: "Economy",
          url: "https://www.nytimes.com/news-event/economy-business-us",
        },
        {
          label: "Technology",
          url: "https://www.nytimes.com/section/technology",
        },
        {
          label: "Personal Tech",
          url: "https://www.nytimes.com/section/technology/personaltech",
        },
      ],
    },
  ];

  const handleCrawlLinks = async () => {
    if (!url) {
      setError("Vui lòng nhập URL");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/crawl-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Không thể lấy danh sách bài viết");
      }

      const data = await response.json();
      setLinkResult(data);
      setActiveStep("links");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectArticle = async (articleUrl: string) => {
    setLoading(true);
    setError("");

    try {
      let response = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: articleUrl }),
      });

      // If NYTimes and failed, try dynamic crawling
      if (!response.ok && articleUrl.includes("nytimes.com")) {
        response = await fetch("/api/crawl-dynamic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: articleUrl }),
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Không thể lấy bài viết");
      }

      const data = await response.json();
      setSelectedArticle(data);
      setActiveStep("article");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi");
    } finally {
      setLoading(false);
    }
  };

  const handleTranslate = async () => {
    if (!selectedArticle) {
      setError("Vui lòng chọn bài viết trước khi dịch");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const sourceLanguage =
        selectedArticle.source === "vnexpress" ? "vi" : "en";
      const targetLanguage =
        selectedArticle.source === "vnexpress" ? "en" : "vi";

      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: selectedArticle.content,
          sourceLanguage,
          targetLanguage,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Không thể dịch bài viết");
      }

      const data = await response.json();
      setTranslation(data.translation);
      setActiveStep("translation");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setUrl("");
    setLinkResult(null);
    setSelectedArticle(null);
    setTranslation("");
    setError("");
    setActiveStep("input");
  };

  const handleBackToLinks = () => {
    setSelectedArticle(null);
    setTranslation("");
    setActiveStep("links");
  };

  const handleUrlSelect = (selectedUrl: string) => {
    setUrl(selectedUrl);
    setOpenDropdown(null);
  };

  const toggleDropdown = (categoryName: string) => {
    setOpenDropdown(openDropdown === categoryName ? null : categoryName);
  };

  const getColorClasses = (color: string) => {
    switch (color) {
      case "red":
        return {
          button: "bg-red-50 text-red-700 border-red-200 hover:bg-red-100",
          dropdown: "border-red-200",
        };
      case "blue":
        return {
          button: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
          dropdown: "border-blue-200",
        };
      case "gray":
        return {
          button: "bg-gray-50 text-gray-900 border-gray-300 hover:bg-gray-100",
          dropdown: "border-gray-300",
        };
      default:
        return {
          button: "bg-gray-50 text-gray-900 border-gray-300 hover:bg-gray-100",
          dropdown: "border-gray-300",
        };
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto max-w-6xl px-6">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Công Cụ Dịch Bài Viết
          </h1>
          <p className="text-gray-600 mb-4">
            Lấy danh sách bài viết và dịch bằng AI
          </p>
          <div className="flex justify-center gap-4 relative">
            {urlCategories.map((category) => {
              const colorClasses = getColorClasses(category.color);
              return (
                <div key={category.name} className="relative">
                  <button
                    onClick={() => toggleDropdown(category.name)}
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border transition-colors ${colorClasses.button}`}
                  >
                    {category.name}
                    <svg
                      className={`ml-1 h-4 w-4 transition-transform ${
                        openDropdown === category.name ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>

                  {openDropdown === category.name && (
                    <div
                      className={`absolute top-full left-0 mt-1 w-48 bg-white border rounded-md shadow-lg z-10 ${colorClasses.dropdown}`}
                    >
                      <div className="py-1">
                        {category.options.map((option, index) => (
                          <button
                            key={index}
                            onClick={() => handleUrlSelect(option.url)}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </header>

        {/* Progress Steps */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center space-x-4">
            <div
              className={`flex items-center ${
                activeStep === "input" ? "text-blue-600" : "text-gray-400"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  activeStep === "input"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-300"
                }`}
              >
                1
              </div>
              <span className="ml-2">Nhập URL</span>
            </div>
            <div className="w-8 h-px bg-gray-300"></div>
            <div
              className={`flex items-center ${
                activeStep === "links" ? "text-blue-600" : "text-gray-400"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  activeStep === "links"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-300"
                }`}
              >
                2
              </div>
              <span className="ml-2">Chọn bài viết</span>
            </div>
            <div className="w-8 h-px bg-gray-300"></div>
            <div
              className={`flex items-center ${
                activeStep === "article" ? "text-blue-600" : "text-gray-400"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  activeStep === "article"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-300"
                }`}
              >
                3
              </div>
              <span className="ml-2">Xem nội dung</span>
            </div>
            <div className="w-8 h-px bg-gray-300"></div>
            <div
              className={`flex items-center ${
                activeStep === "translation" ? "text-blue-600" : "text-gray-400"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  activeStep === "translation"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-300"
                }`}
              >
                4
              </div>
              <span className="ml-2">Bản dịch</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
            {error}
          </div>
        )}

        {/* Step 1: URL Input */}
        {activeStep === "input" && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  URL Trang Chủ hoặc Chuyên Mục
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Nhập URL trang chủ VNExpress (VN/EN) hoặc New York Times... hoặc chọn từ dropdown phía trên"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-sm text-gray-500 mt-1">
                  💡 Mẹo: Bấm vào các tag phía trên để chọn URL có sẵn
                </p>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={handleCrawlLinks}
                  disabled={loading || !url}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-md font-medium transition-colors disabled:cursor-not-allowed"
                >
                  {loading ? "Đang lấy danh sách..." : "Lấy Danh Sách Bài Viết"}
                </button>
                <button
                  onClick={handleReset}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-md font-medium transition-colors"
                >
                  Xóa
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Article Links */}
        {activeStep === "links" && linkResult && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                Danh Sách Bài Viết ({linkResult.totalFound} bài)
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={handleReset}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md font-medium transition-colors"
                >
                  Quay lại
                </button>
              </div>
            </div>
            <div className="grid gap-4 max-h-96 overflow-y-auto">
              {linkResult.links.map((link, index) => (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => handleSelectArticle(link.url)}
                >
                  <h3 className="font-medium text-gray-900 mb-2 line-clamp-2">
                    {link.title}
                  </h3>
                  {link.summary && (
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {link.summary}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Selected Article */}
        {activeStep === "article" && selectedArticle && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block px-3 py-1 rounded-full text-xs font-bold text-white ${
                    selectedArticle.source === "vnexpress"
                      ? "bg-red-600"
                      : selectedArticle.source === "vnexpress-en"
                      ? "bg-blue-600"
                      : "bg-gray-900"
                  }`}
                >
                  {selectedArticle.source === "vnexpress"
                    ? "VNEXPRESS VN"
                    : selectedArticle.source === "vnexpress-en"
                    ? "VNEXPRESS EN"
                    : "NEW YORK TIMES"}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleBackToLinks}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md font-medium transition-colors"
                >
                  Quay lại danh sách
                </button>
                <button
                  onClick={handleTranslate}
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md font-medium transition-colors disabled:cursor-not-allowed"
                >
                  {loading
                    ? "Đang dịch..."
                    : `Dịch sang ${
                        selectedArticle.source === "vnexpress"
                          ? "Tiếng Anh"
                          : selectedArticle.source === "vnexpress-en"
                          ? "Tiếng Việt"
                          : "Tiếng Việt"
                      }`}
                </button>
              </div>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-3">
              {selectedArticle.title}
            </h2>
            <div className="text-sm text-gray-600 mb-4">
              <span className="font-medium">
                Tác giả: {selectedArticle.author}
              </span>
              <span className="mx-2">•</span>
              <span>{selectedArticle.date}</span>
            </div>
            {selectedArticle.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {selectedArticle.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <div className="text-gray-700 leading-relaxed max-w-none max-h-64 overflow-y-auto">
              <p className="text-justify whitespace-pre-line">
                {selectedArticle.content}
              </p>
            </div>
          </div>
        )}

        {/* Step 4: Translation */}
        {activeStep === "translation" && translation && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                Bản Dịch (
                {selectedArticle?.source === "vnexpress"
                  ? "Tiếng Anh"
                  : selectedArticle?.source === "vnexpress-en"
                  ? "Tiếng Việt"
                  : "Tiếng Việt"}
                )
              </h3>
              <button
                onClick={() => setActiveStep("article")}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md font-medium transition-colors"
              >
                Xem bài gốc
              </button>
            </div>
            <div className="prose max-w-none">
              <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                {translation}
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between text-sm text-gray-500">
              <span>
                Bài gốc:{" "}
                {selectedArticle?.content.split(" ").length.toLocaleString() ||
                  0}{" "}
                từ
              </span>
              <span>
                Bản dịch: {translation.split(" ").length.toLocaleString()} từ
              </span>
            </div>
          </div>
        )}

        {loading && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 flex items-center space-x-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="text-gray-700">Đang xử lý...</span>
            </div>
          </div>
        )}

        {/* Click outside to close dropdowns */}
        {openDropdown && (
          <div
            className="fixed inset-0 z-0"
            onClick={() => setOpenDropdown(null)}
          />
        )}
      </div>
    </div>
  );
}
