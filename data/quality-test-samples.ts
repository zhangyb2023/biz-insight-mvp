export interface QualityTestSample {
  case_name: string;
  case_reason: string;
  url: string;
  title: string;
  content: string;
  expected: {
    source_type: string;
    is_high_value: boolean;
    is_noise: boolean;
    min_score?: number;
    max_score?: number;
  };
}

export const qualityTestSamples: QualityTestSample[] = [
  // 1. 竞争对手官网产品页
  {
    case_name: "Vector产品解决方案页",
    case_reason: "官网产品页，高商业价值，应识别为产品页并判为高价值",
    url: "https://www.vector.com/cn/zh/products/solutions/",
    title: "Vector产品解决方案",
    content: "Vector提供完整的AUTOSAR解决方案，帮助客户快速实现软件定义汽车。该方案涵盖底层驱动、中间件、应用层等完整技术栈，支持多种硬件平台。",
    expected: {
      source_type: "company_product_page",
      is_high_value: true,
      is_noise: false,
      min_score: 70
    }
  },
  // 2. 竞争对手官网方案/案例页
  {
    case_name: "Vector成功案例页",
    case_reason: "案例页含实际应用场景，应识别为案例页并判为高价值",
    url: "https://www.vector.com/cn/zh/case/success/",
    title: "成功案例 - 某主机厂采用Vector工具",
    content: "某知名主机厂采用Vector AUTOSAR工具链，成功实现域控制器软件平台开发，缩短开发周期6个月，提升代码质量30%以上，获得客户高度认可。",
    expected: {
      source_type: "company_case_study",
      is_high_value: true,
      is_noise: false,
      min_score: 60
    }
  },
  // 3. 竞争对手官网新闻页（长内容）
  {
    case_name: "Vector新闻详情页-长内容",
    case_reason: "官网新闻详情页，内容充实且行业相关，应有一定分值",
    url: "https://www.vector.com/cn/zh/news/2024/product-launch/",
    title: "Vector发布新一代AUTOSAR工具",
    content: "Vector近日发布最新版本AUTOSAR开发工具，支持最新的自适应平台标准，提供更高效的调试和诊断功能，帮助客户加速软件开发。该版本增加了对最新芯片平台的支持。",
    expected: {
      source_type: "company_product_page",
      is_high_value: true,
      is_noise: false,
      min_score: 70
    }
  },
  // 4. 竞争对手官网新闻页（短内容）
  {
    case_name: "Vector新闻列表页",
    case_reason: "官网新闻列表页，内容短，应识别为低价值",
    url: "https://www.vector.com/cn/zh/news/news/",
    title: "Vector新闻中心",
    content: "近日公司发布新产品",
    expected: {
      source_type: "company_newsroom",
      is_high_value: false,
      is_noise: false,
      max_score: 60
    }
  },
  // 5. 文档/白皮书/技术文档页
  {
    case_name: "Vector白皮书PDF",
    case_reason: "技术文档页，含技术内容，应识别为文档类型",
    url: "https://www.vector.com/cn/zh/download/whitepaper-autosar.pdf",
    title: "AUTOSAR技术白皮书",
    content: "本文档详细介绍AUTOSAR标准架构，包括自适应平台和经典平台的核心组件，适用于汽车电子软件开发工程师参考学习。",
    expected: {
      source_type: "document_or_pdf",
      is_high_value: true,
      is_noise: false,
      min_score: 50
    }
  },
  // 6. 综合新闻门户页
  {
    case_name: "新浪新闻首页",
    case_reason: "综合门户，应识别为generic_news_portal并判为噪音",
    url: "https://news.sina.com.cn/",
    title: "新浪新闻 - 首页",
    content: "今日要闻摘要",
    expected: {
      source_type: "generic_news_portal",
      is_high_value: false,
      is_noise: true,
      max_score: 30
    }
  },
  // 7. 列表页/聚合页
  {
    case_name: "Vector新闻列表页",
    case_reason: "纯列表页，信息量低，应明显降分",
    url: "https://www.vector.com/cn/zh/news/list/",
    title: "新闻列表 - 更多资讯",
    content: "新闻1标题\n新闻2标题\n新闻3标题\n新闻4标题\n新闻5标题",
    expected: {
      source_type: "company_newsroom",
      is_high_value: false,
      is_noise: false,
      max_score: 30
    }
  },
  // 8. 明显噪音页
  {
    case_name: "汽车之家娱乐新闻",
    case_reason: "行业媒体但主题无关，应判为噪音",
    url: "https://www.autohome.com.cn/news/99999/",
    title: "明星离婚引发热议",
    content: "某明星今日宣布离婚，引发网友热议",
    expected: {
      source_type: "industry_media",
      is_high_value: false,
      is_noise: true,
      max_score: 20
    }
  },
  // 9. 行业媒体页
  {
    case_name: "汽车之家技术文章",
    case_reason: "行业媒体且主题相关，应有一定分值",
    url: "https://www.autohome.com.cn/news/12345/",
    title: "AUTOSAR技术深度解析",
    content: "本文深入分析AUTOSAR自适应平台在智能驾驶域控制器中的应用，从架构设计到代码实现全面介绍，包含实际项目经验总结。",
    expected: {
      source_type: "industry_media",
      is_high_value: false,
      is_noise: false,
      min_score: 50
    }
  },
  // 10. 招聘页
  {
    case_name: "Vector招聘页",
    case_reason: "招聘页，商业洞察价值有限，应识别为招聘页并低分",
    url: "https://www.vector.com/cn/zh/career/",
    title: "加入Vector - 招聘职位",
    content: "我们正在招聘嵌入式软件工程师、系统架构师等职位，欢迎投递简历",
    expected: {
      source_type: "recruitment_page",
      is_high_value: false,
      is_noise: false,
      max_score: 40
    }
  },
  // 11. 联系我们/关于页
  {
    case_name: "Vector关于页",
    case_reason: "官网通用页，非核心内容页，分值应偏低",
    url: "https://www.vector.com/cn/zh/about/",
    title: "关于Vector",
    content: "Vector是全球领先的汽车电子工具和软件供应商，总部位于德国",
    expected: {
      source_type: "company_official",
      is_high_value: false,
      is_noise: false,
      max_score: 60
    }
  },
  // 12. 生态合作页
  {
    case_name: "Vector合作伙伴页",
    case_reason: "生态合作伙伴页，有商业价值，应识别为生态页并判高价值",
    url: "https://www.vector.com/cn/zh/partner/",
    title: "合作伙伴计划",
    content: "Vector与多家主流芯片厂商建立战略合作伙伴关系，包括NXP、Infineon、Renesas等，共同推动汽车电子生态发展。",
    expected: {
      source_type: "ecosystem_partner",
      is_high_value: true,
      is_noise: false,
      min_score: 50
    }
  },
  // 13. 空内容页
  {
    case_name: "空内容页",
    case_reason: "无内容，应明显判为噪音",
    url: "https://www.example.com/empty/",
    title: "空页面",
    content: "",
    expected: {
      source_type: "unknown",
      is_high_value: false,
      is_noise: true,
      max_score: 30
    }
  },
  // 14. 社交平台页
  {
    case_name: "微博企业页",
    case_reason: "社交平台，非专业内容，应识别为社交平台并判噪音",
    url: "https://weibo.com/vector",
    title: "Vector官方微博",
    content: "欢迎关注Vector官方微博",
    expected: {
      source_type: "social_platform",
      is_high_value: false,
      is_noise: true,
      max_score: 30
    }
  },
  // 15. 视频平台页
  {
    case_name: "B站产品视频",
    case_reason: "视频平台，不利文本分析，应识别为视频平台",
    url: "https://bilibili.com/video/BV123456",
    title: "产品介绍视频",
    content: "视频内容请访问视频平台观看",
    expected: {
      source_type: "video_platform",
      is_high_value: false,
      is_noise: true,
      max_score: 30
    }
  },
  // 16. 官网首页
  {
    case_name: "Vector官网首页",
    case_reason: "官网首页，应识别为company_official",
    url: "https://www.vector.com/cn/zh/",
    title: "Vector - 汽车电子工具与软件供应商",
    content: "Vector是全球领先的汽车电子工具和软件供应商，帮助工程师简化嵌入式系统开发。",
    expected: {
      source_type: "company_official",
      is_high_value: false,
      is_noise: false,
      min_score: 40
    }
  },
  // 17. 普华基础软件产品页
  {
    case_name: "普华产品页",
    case_reason: "国内厂商产品页，应识别为产品页",
    url: "https://www.i-soft.com.cn/product/vehicle.html",
    title: "普华车用操作系统产品介绍",
    content: "普华基础软件提供完整的车用操作系统解决方案，支持AUTOSAR标准，适用于智能驾驶域控制器。",
    expected: {
      source_type: "company_product_page",
      is_high_value: true,
      is_noise: false,
      min_score: 70
    }
  },
  // 18. 网易新闻页
  {
    case_name: "网易新闻页",
    case_reason: "综合门户，应识别为generic_news_portal",
    url: "https://news.163.com/24/0101/12/ABC123.html",
    title: "网易新闻 - 今日头条",
    content: "今日要闻",
    expected: {
      source_type: "generic_news_portal",
      is_high_value: false,
      is_noise: true,
      max_score: 30
    }
  },
  // 19. 搜狐新闻页
  {
    case_name: "搜狐新闻页",
    case_reason: "综合门户，应识别为generic_news_portal",
    url: "https://www.sohu.com/a/123456789_123456.html",
    title: "搜狐新闻 - 热点推荐",
    content: "热点推荐内容摘要",
    expected: {
      source_type: "generic_news_portal",
      is_high_value: false,
      is_noise: true,
      max_score: 30
    }
  },
  // 20. 行业媒体-汽车之家
  {
    case_name: "汽车之家新闻页",
    case_reason: "行业媒体，应识别为industry_media",
    url: "https://www.autohome.com.cn/news/88888/",
    title: "新车上市报道",
    content: "近日某品牌发布新款车型，配备最新智能驾驶技术，引起市场关注。",
    expected: {
      source_type: "industry_media",
      is_high_value: false,
      is_noise: false,
      min_score: 40
    }
  },
  // 21. 盖世汽车新闻
  {
    case_name: "盖世汽车新闻",
    case_reason: "行业媒体，应识别为industry_media",
    url: "https://www.gasgoo.com/news/123456.html",
    title: "汽车行业新闻动态",
    content: "盖世汽车为您带来最新行业资讯报道，分析市场发展趋势。",
    expected: {
      source_type: "industry_media",
      is_high_value: false,
      is_noise: false,
      min_score: 40
    }
  },
  // 22. 官网新闻-短内容导航页
  {
    case_name: "中科创达新闻页",
    case_reason: "官网新闻列表页，内容短，应低分",
    url: "https://www.thundersoft.com/category/newsroom/",
    title: "新闻 - ThunderSoft",
    content: "近日公司参加行业展会",
    expected: {
      source_type: "company_newsroom",
      is_high_value: false,
      is_noise: false,
      max_score: 50
    }
  },
  // 23. 电装官网产品页
  {
    case_name: "电装产品页",
    case_reason: "日系厂商产品页，应识别为产品页",
    url: "https://www.denso.com/global/en/products-and-services/automotive/",
    title: "电装汽车产品与解决方案",
    content: "电装提供全面的汽车零部件和解决方案，涵盖动力总成、安全系统、信息娱乐等领域。",
    expected: {
      source_type: "company_product_page",
      is_high_value: true,
      is_noise: false,
      min_score: 70
    }
  },
  // 24. 极氪官网
  {
    case_name: "极氪官网首页",
    case_reason: "主机厂官网，应识别为官网",
    url: "https://www.zeekrlife.com/",
    title: "极氪 - 高端智能纯电品牌",
    content: "极氪是吉利旗下高端智能纯电品牌，致力于为用户提供卓越的智能电动汽车。",
    expected: {
      source_type: "company_official",
      is_high_value: false,
      is_noise: false,
      min_score: 40
    }
  },
  // 25. 综合门户-腾讯新闻
  {
    case_name: "腾讯新闻页",
    case_reason: "综合门户，应识别为generic_news_portal",
    url: "https://news.qq.com/2024/01/15/123.htm",
    title: "腾讯新闻 - 今日要闻",
    content: "今日要闻摘要",
    expected: {
      source_type: "generic_news_portal",
      is_high_value: false,
      is_noise: true,
      max_score: 30
    }
  }
];
