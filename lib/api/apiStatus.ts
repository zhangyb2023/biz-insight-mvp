/**
 * API 状态检查模块
 * 检查各API服务的使用限额和余量
 */

export interface ApiStatus {
  name: string;
  key: string;
  status: "active" | "invalid" | "unauthorized" | "error" | "unknown";
  message: string;
  description?: string;
  quota?: {
    used?: number;
    limit?: number;
    remaining?: number;
    resetDate?: string;
    message?: string;
  };
}

export async function checkFirecrawlStatus(): Promise<ApiStatus> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    return {
      name: "Firecrawl",
      key: "未配置",
      status: "error",
      message: "API Key 未配置",
      description: "智能爬取：深度爬取 + JS渲染"
    };
  }

  const maskedKey = apiKey.slice(0, 8) + "..." + apiKey.slice(-4);

  try {
    // 尝试用example.com验证key有效性
    const response = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({ url: "https://example.com" }),
      signal: AbortSignal.timeout(15000)
    });

    if (response.status === 401 || response.status === 403) {
      return {
        name: "Firecrawl",
        key: maskedKey,
        status: "unauthorized",
        message: "API Key 无效或已过期",
        description: "智能爬取：深度爬取 + JS渲染"
      };
    }

    if (!response.ok) {
      return {
        name: "Firecrawl",
        key: maskedKey,
        status: "error",
        message: `HTTP ${response.status}`,
        description: "智能爬取：深度爬取 + JS渲染"
      };
    }

    const data = await response.json();
    if (data.success) {
      return {
        name: "Firecrawl",
        key: maskedKey,
        status: "active",
        message: "API Key 有效",
        description: "智能爬取：深度爬取 + JS渲染",
        quota: {
          message: "请登录 firecrawl.dev 查看配额"
        }
      };
    }

    return {
      name: "Firecrawl",
      key: maskedKey,
      status: "error",
      message: data.error || "未知错误",
      description: "智能爬取：深度爬取 + JS渲染"
    };
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return {
        name: "Firecrawl",
        key: maskedKey,
        status: "error",
        message: "请求超时",
        description: "智能爬取：深度爬取 + JS渲染"
      };
    }
    return {
      name: "Firecrawl",
      key: maskedKey,
      status: "error",
      message: error instanceof Error ? error.message : "网络错误",
      description: "智能爬取：深度爬取 + JS渲染"
    };
  }
}

export async function checkTavilyStatus(): Promise<ApiStatus> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return {
      name: "Tavily",
      key: "未配置",
      status: "error",
      message: "API Key 未配置",
      description: "专业发现：探测专业论坛/垂直网站"
    };
  }

  const maskedKey = apiKey.slice(0, 8) + "..." + apiKey.slice(-4);

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: "test",
        max_results: 1
      }),
      signal: AbortSignal.timeout(15000)
    });

    if (response.status === 401 || response.status === 403) {
      return {
        name: "Tavily",
        key: maskedKey,
        status: "unauthorized",
        message: "API Key 无效或已过期",
        description: "专业发现：探测专业论坛/垂直网站"
      };
    }

    if (!response.ok) {
      return {
        name: "Tavily",
        key: maskedKey,
        status: "error",
        message: `HTTP ${response.status}`,
        description: "专业发现：探测专业论坛/垂直网站"
      };
    }

    return {
      name: "Tavily",
      key: maskedKey,
      status: "active",
      message: "API Key 有效",
      description: "专业发现：探测专业论坛/垂直网站",
      quota: {
        message: "Dev Key: 1000请求/月，登录 tavily.ai 查看详细配额"
      }
    };
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return {
        name: "Tavily",
        key: maskedKey,
        status: "error",
        message: "请求超时",
        description: "专业发现：探测专业论坛/垂直网站"
      };
    }
    return {
      name: "Tavily",
      key: maskedKey,
      status: "error",
      message: error instanceof Error ? error.message : "网络错误",
      description: "专业发现：探测专业论坛/垂直网站"
    };
  }
}

export async function checkDeepseekStatus(): Promise<ApiStatus> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return {
      name: "DeepSeek",
      key: "未配置",
      status: "error",
      message: "API Key 未配置",
      description: "LLM推理：新闻分类 + 洞察聚合"
    };
  }

  const maskedKey = apiKey.slice(0, 8) + "..." + apiKey.slice(-4);

  try {
    const response = await fetch("https://api.deepseek.com/user/balance", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`
      },
      signal: AbortSignal.timeout(15000)
    });

    if (response.status === 401 || response.status === 403) {
      return {
        name: "DeepSeek",
        key: maskedKey,
        status: "unauthorized",
        message: "API Key 无效或已过期",
        description: "LLM推理：新闻分类 + 洞察聚合"
      };
    }

    if (!response.ok) {
      return {
        name: "DeepSeek",
        key: maskedKey,
        status: "error",
        message: `HTTP ${response.status}`,
        description: "LLM推理：新闻分类 + 洞察聚合"
      };
    }

    const data = await response.json();
    
    // DeepSeek API返回格式: { is_available: true, balance_infos: [{ currency: "CNY", total_balance: "10.00", granted_balance: "0", topped_up_balance: "10.00" }] }
    if (data.balance_infos && data.balance_infos.length > 0) {
      const balance = data.balance_infos[0];
      return {
        name: "DeepSeek",
        key: maskedKey,
        status: "active",
        message: "API Key 有效",
        description: "LLM推理：新闻分类 + 洞察聚合",
        quota: {
          message: `余额: ${balance.total_balance} ${balance.currency}`
        }
      };
    }

    return {
      name: "DeepSeek",
      key: maskedKey,
      status: "active",
      message: "API Key 有效",
      description: "LLM推理：新闻分类 + 洞察聚合"
    };
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return {
        name: "DeepSeek",
        key: maskedKey,
        status: "error",
        message: "请求超时",
        description: "LLM推理：新闻分类 + 洞察聚合"
      };
    }
    return {
      name: "DeepSeek",
      key: maskedKey,
      status: "error",
      message: error instanceof Error ? error.message : "网络错误",
      description: "LLM推理：新闻分类 + 洞察聚合"
    };
  }
}

export async function checkJinaStatus(): Promise<ApiStatus> {
  // Jina Reader 是免费的，不需要key
  try {
    const response = await fetch("https://r.jina.ai/https://example.com", {
      signal: AbortSignal.timeout(15000)
    });

    if (response.ok) {
      return {
        name: "Jina Reader",
        key: "免费无需Key",
        status: "active",
        message: "服务正常",
        description: "页面内容提取：将网页转文本"
      };
    }

    return {
      name: "Jina Reader",
      key: "免费无需Key",
      status: "error",
      message: `HTTP ${response.status}`,
      description: "页面内容提取：将网页转文本"
    };
  } catch (error) {
    return {
      name: "Jina Reader",
      key: "免费无需Key",
      status: "error",
      message: error instanceof Error ? error.message : "网络错误",
      description: "页面内容提取：将网页转文本"
    };
  }
}

export async function checkSiliconFlowStatus(): Promise<ApiStatus> {
  const apiKey = process.env.SILICONFLOW_API_KEY;
  if (!apiKey) {
    return {
      name: "SiliconFlow",
      key: "未配置",
      status: "error",
      message: "API Key 未配置",
      description: "向量嵌入：语义相似度匹配"
    };
  }

  const maskedKey = apiKey.slice(0, 8) + "..." + apiKey.slice(-4);

  try {
    const response = await fetch("https://api.siliconflow.cn/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "BAAI/bge-large-zh-v1.5",
        input: "test"
      }),
      signal: AbortSignal.timeout(15000)
    });

    if (response.status === 401 || response.status === 403) {
      return {
        name: "SiliconFlow",
        key: maskedKey,
        status: "unauthorized",
        message: "API Key 无效或已过期",
        description: "向量嵌入：语义相似度匹配"
      };
    }

    if (!response.ok) {
      return {
        name: "SiliconFlow",
        key: maskedKey,
        status: "error",
        message: `HTTP ${response.status}`,
        description: "向量嵌入：语义相似度匹配"
      };
    }

    const data = await response.json();
    if (data.data && data.data.length > 0) {
      return {
        name: "SiliconFlow",
        key: maskedKey,
        status: "active",
        message: "API Key 有效",
        description: "向量嵌入：语义相似度匹配",
        quota: {
          message: "置信率计算：判断新闻与洞察的语义相关性"
        }
      };
    }

    return {
      name: "SiliconFlow",
      key: maskedKey,
      status: "error",
      message: "响应格式异常",
      description: "向量嵌入：语义相似度匹配"
    };
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return {
        name: "SiliconFlow",
        key: maskedKey,
        status: "error",
        message: "请求超时",
        description: "向量嵌入：语义相似度匹配"
      };
    }
    return {
      name: "SiliconFlow",
      key: maskedKey,
      status: "error",
      message: error instanceof Error ? error.message : "网络错误",
      description: "向量嵌入：语义相似度匹配"
    };
  }
}

export async function getAllApiStatus(): Promise<ApiStatus[]> {
  const [jina, firecrawl, tavily, deepseek, siliconflow] = await Promise.all([
    checkJinaStatus(),
    checkFirecrawlStatus(),
    checkTavilyStatus(),
    checkDeepseekStatus(),
    checkSiliconFlowStatus()
  ]);
  return [jina, firecrawl, tavily, deepseek, siliconflow];
}
