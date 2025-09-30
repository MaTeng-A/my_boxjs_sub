// 黄金数据监控脚本 - Loon兼容版本
// 支持上海黄金交易所和上海期货交易所

// 配置区域
const CONFIG = {
  // 聚合数据API密钥 (必填)
  apiKey: "f24e2fa4068b20c4d44fbff66b7745de",
  
  // 接口地址
  apiUrls: {
    shfe: "http://web.juhe.cn/finance/gold/shgold",
    sfe: "http://web.juhe.cn/finance/gold/sfefutures"
  },
  
  // 通知设置
  notification: {
    enable: true,
    sound: true
  }
};

// 存储API使用情况
function getAPIUsage() {
  const storage = $persistentStore.read("gold_api_usage");
  if (storage) {
    return JSON.parse(storage);
  }
  return {
    date: new Date().toDateString(),
    count: 0,
    lastUpdate: null
  };
}

function recordAPICall() {
  let usage = getAPIUsage();
  const today = new Date().toDateString();
  
  if (usage.date !== today) {
    usage = {
      date: today,
      count: 0,
      lastUpdate: new Date().toISOString()
    };
  }
  
  usage.count++;
  usage.lastUpdate = new Date().toISOString();
  
  $persistentStore.write(JSON.stringify(usage), "gold_api_usage");
  return usage;
}

function getRemainingCalls() {
  const usage = getAPIUsage();
  const today = new Date().toDateString();
  
  if (usage.date !== today) {
    return 50;
  }
  
  return Math.max(0, 50 - usage.count);
}

// 主函数 - 获取黄金数据
async function getAllGoldData() {
  console.log("开始获取黄金数据...");
  
  const remaining = getRemainingCalls();
  if (remaining <= 0) {
    console.log("今日API调用次数已用完");
    if (CONFIG.notification.enable) {
      $notification.post("📈 黄金数据", "今日API调用次数已用完", "请明天再试");
    }
    $done();
    return;
  }
  
  const currentTime = new Date();
  const dayOfWeek = currentTime.getDay();
  
  // 检查是否为周末
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    console.log("周末市场休市，跳过数据获取");
    if (CONFIG.notification.enable) {
      $notification.post("📈 黄金市场", "周末休市，无数据更新", "市场开放时间: 周一至周五");
    }
    $done();
    return;
  }
  
  try {
    console.log(`开始API调用，今日剩余次数: ${remaining - 2}`);
    
    const [shfeData, sfeData] = await Promise.all([
      getExchangeData("shfe"),
      getExchangeData("sfe")
    ]);
    
    // 记录API调用 (2次)
    recordAPICall();
    recordAPICall();
    
    const updatedRemaining = getRemainingCalls();
    await processAndDisplayData(shfeData, sfeData, updatedRemaining);
    
  } catch (error) {
    console.log(`获取数据失败: ${error}`);
    // 即使失败也记录API调用
    recordAPICall();
    recordAPICall();
    
    if (CONFIG.notification.enable) {
      $notification.post("❌ 黄金数据获取失败", error.message || "未知错误", "");
    }
  }
  
  $done();
}

// 单独获取上海黄金交易所数据
async function getSHFEData() {
  await getSingleExchangeData("shfe");
}

// 单独获取上海期货交易所数据
async function getSFEData() {
  await getSingleExchangeData("sfe");
}

// 获取单个交易所数据
async function getSingleExchangeData(exchange) {
  const remaining = getRemainingCalls();
  if (remaining <= 0) {
    console.log("今日API调用次数已用完");
    if (CONFIG.notification.enable) {
      $notification.post("📈 黄金数据", "今日API调用次数已用完", "请明天再试");
    }
    $done();
    return;
  }
  
  try {
    console.log(`获取 ${exchange} 数据，今日剩余次数: ${remaining - 1}`);
    
    const data = await getExchangeData(exchange);
    recordAPICall();
    
    const updatedRemaining = getRemainingCalls();
    let content = "";
    let title = "";
    
    if (exchange === "shfe") {
      title = "🏛️ 上海金交";
      content = processSHFEData(data.data) || "暂无数据";
    } else {
      title = "📊 上海期货";
      content = processSFEData(data.data) || "暂无数据";
    }
    
    if (CONFIG.notification.enable) {
      $notification.post(
        title,
        content,
        `更新时间: ${new Date().toLocaleTimeString()} | 今日剩余: ${updatedRemaining}次`
      );
    }
    
  } catch (error) {
    console.log(`获取 ${exchange} 数据失败: ${error}`);
    recordAPICall();
    
    if (CONFIG.notification.enable) {
      $notification.post(`❌ ${exchange}数据获取失败`, error.message, "");
    }
  }
  
  $done();
}

// 查看API使用情况
function checkAPIUsage() {
  const usage = getAPIUsage();
  const remaining = getRemainingCalls();
  
  const message = `今日已用: ${usage.count}次\n剩余次数: ${remaining}次\n最后更新: ${usage.lastUpdate ? new Date(usage.lastUpdate).toLocaleTimeString() : "无"}`;
  
  if (CONFIG.notification.enable) {
    $notification.post("📊 API使用情况", message, "黄金数据接口");
  }
  
  console.log(message);
  $done();
}

// 获取交易所数据的通用函数
async function getExchangeData(exchange) {
  const url = `${CONFIG.apiUrls[exchange]}?key=${CONFIG.apiKey}`;
  
  console.log(`请求 ${exchange} 数据`);
  
  const response = await $http.get({
    url: url,
    timeout: 10
  });
  
  if (response.status !== 200) {
    throw new Error(`${exchange} 请求失败: HTTP ${response.status}`);
  }
  
  const data = response.data;
  
  if (data.error_code !== 0) {
    throw new Error(`${exchange} API错误: ${data.reason} (${data.error_code})`);
  }
  
  return {
    exchange: exchange,
    data: data.result,
    timestamp: new Date().getTime()
  };
}

// 处理并显示数据
async function processAndDisplayData(shfeData, sfeData, remainingCalls) {
  let notificationTitle = "📈 黄金价格";
  let notificationContent = "";
  let hasValidData = false;
  
  // 处理上海黄金交易所数据
  if (shfeData && shfeData.data) {
    const processedSHFE = processSHFEData(shfeData.data);
    if (processedSHFE) {
      notificationContent += "🏛️ 上海金交:\n" + processedSHFE + "\n";
      hasValidData = true;
    }
  }
  
  // 处理上海期货交易所数据
  if (sfeData && sfeData.data) {
    const processedSFE = processSFEData(sfeData.data);
    if (processedSFE) {
      notificationContent += "📊 上海期货:\n" + processedSFE;
      hasValidData = true;
    }
  }
  
  // 添加API使用情况
  const usageInfo = `今日剩余: ${remainingCalls}次`;
  
  // 发送通知
  if (CONFIG.notification.enable && hasValidData) {
    const updateTime = new Date().toLocaleTimeString();
    $notification.post(
      notificationTitle,
      notificationContent,
      `更新时间: ${updateTime} | ${usageInfo}`
    );
  } else if (!hasValidData) {
    console.log("没有有效数据");
    if (CONFIG.notification.enable) {
      $notification.post("📈 黄金市场", "当前无交易数据", `可能市场已收盘 | ${usageInfo}`);
    }
  }
  
  console.log(`数据处理完成，${usageInfo}`);
}

// 处理上海黄金交易所数据
function processSHFEData(data) {
  let content = "";
  
  try {
    if (Array.isArray(data)) {
      data.forEach(item => {
        const variety = item.variety || item.name || item.productName || "未知品种";
        const latestPrice = item.latestpri || item.price || item.lastPrice || "N/A";
        const changePercent = item.limit || item.changePercent || item.updownRate || "N/A";
        
        if (variety !== "未知品种" && latestPrice !== "N/A") {
          content += `${variety}: ${latestPrice}`;
          if (changePercent !== "N/A") {
            content += ` (${changePercent})`;
          }
          content += "\n";
        }
      });
    } else if (typeof data === 'object') {
      const variety = data.variety || data.name || data.productName || "未知品种";
      const latestPrice = data.latestpri || data.price || data.lastPrice || "N/A";
      const changePercent = data.limit || data.changePercent || data.updownRate || "N/A";
      
      if (variety !== "未知品种" && latestPrice !== "N/A") {
        content += `${variety}: ${latestPrice}`;
        if (changePercent !== "N/A") {
          content += ` (${changePercent})`;
        }
        content += "\n";
      }
    }
  } catch (error) {
    console.log("处理上海金交数据时出错:", error);
  }
  
  return content || null;
}

// 处理上海期货交易所数据
function processSFEData(data) {
  let content = "";
  
  try {
    if (Array.isArray(data)) {
      data.forEach(item => {
        const variety = item.name || item.variety || item.contract || "未知合约";
        const latestPrice = item.price || item.latestpri || item.lastPrice || "N/A";
        const changePercent = item.changePercent || item.limit || item.updownRate || "N/A";
        
        if (variety !== "未知合约" && latestPrice !== "N/A") {
          content += `${variety}: ${latestPrice}`;
          if (changePercent !== "N/A") {
            content += ` (${changePercent})`;
          }
          content += "\n";
        }
      });
    } else if (typeof data === 'object') {
      const variety = data.name || data.variety || data.contract || "未知合约";
      const latestPrice = data.price || data.latestpri || data.lastPrice || "N/A";
      const changePercent = data.changePercent || data.limit || data.updownRate || "N/A";
      
      if (variety !== "未知合约" && latestPrice !== "N/A") {
        content += `${variety}: ${latestPrice}`;
        if (changePercent !== "N/A") {
          content += ` (${changePercent})`;
        }
        content += "\n";
      }
    }
  } catch (error) {
    console.log("处理上海期货数据时出错:", error);
  }
  
  return content || null;
}

// 根据URL参数决定执行哪个函数
function main() {
  // 获取脚本参数
  const scriptType = typeof $argument !== "undefined" ? $argument : "all";
  
  console.log(`执行脚本类型: ${scriptType}`);
  
  switch (scriptType) {
    case "shfe":
      getSHFEData();
      break;
    case "sfe":
      getSFEData();
      break;
    case "usage":
      checkAPIUsage();
      break;
    case "all":
    default:
      getAllGoldData();
      break;
  }
}

// 启动脚本
main();
