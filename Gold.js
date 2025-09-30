// 黄金数据监控脚本 - 兼容低版本Loon
// 使用兼容的HTTP请求方法

// 配置区域
const CONFIG = {
  apiKey: "f24e2fa4068b20c4d44fbff66b7745de", // 请替换为您的API密钥
  apiUrls: {
    shfe: "http://web.juhe.cn/finance/gold/shgold",
    sfe: "http://web.juhe.cn/finance/gold/sfefutures"
  },
  notification: {
    enable: true,
    sound: true
  }
};

// 兼容的HTTP请求函数
function httpGet(url) {
  return new Promise((resolve, reject) => {
    // 方法1: 尝试使用 $http
    if (typeof $http !== 'undefined' && $http.get) {
      $http.get({
        url: url,
        timeout: 10
      }).then(resp => {
        resolve(resp);
      }).catch(error => {
        reject(error);
      });
    }
    // 方法2: 尝试使用 $tool
    else if (typeof $tool !== 'undefined' && $tool.get) {
      $tool.get({
        url: url
      }).then(resp => {
        resolve(resp);
      }).catch(error => {
        reject(error);
      });
    }
    // 方法3: 使用XMLHttpRequest (最兼容)
    else {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.timeout = 10000;
      xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
          if (xhr.status === 200) {
            resolve({
              status: 200,
              data: JSON.parse(xhr.responseText)
            });
          } else {
            reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
          }
        }
      };
      xhr.ontimeout = function() {
        reject(new Error('Request timeout'));
      };
      xhr.onerror = function() {
        reject(new Error('Network error'));
      };
      xhr.send();
    }
  });
}

// 存储API使用情况
function getAPIUsage() {
  const storage = $persistentStore.read("gold_api_usage");
  return storage ? JSON.parse(storage) : {
    date: new Date().toDateString(),
    count: 0,
    lastUpdate: null
  };
}

function recordAPICall() {
  let usage = getAPIUsage();
  const today = new Date().toDateString();
  
  if (usage.date !== today) {
    usage = { date: today, count: 0, lastUpdate: null };
  }
  
  usage.count++;
  usage.lastUpdate = new Date().toISOString();
  $persistentStore.write(JSON.stringify(usage), "gold_api_usage");
  return usage;
}

function getRemainingCalls() {
  const usage = getAPIUsage();
  return usage.date === new Date().toDateString() ? Math.max(0, 50 - usage.count) : 50;
}

// 主函数
async function getAllGoldData() {
  console.log("开始获取黄金数据...");
  
  const remaining = getRemainingCalls();
  if (remaining <= 0) {
    sendNotification("📈 黄金数据", "今日API调用次数已用完", "请明天再试");
    $done();
    return;
  }
  
  // 周末检查
  const dayOfWeek = new Date().getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    sendNotification("📈 黄金市场", "周末休市，无数据更新", "市场开放时间: 周一至周五");
    $done();
    return;
  }
  
  try {
    console.log(`开始API调用，今日剩余次数: ${remaining - 2}`);
    
    const [shfeData, sfeData] = await Promise.all([
      getExchangeData("shfe"),
      getExchangeData("sfe")
    ]);
    
    recordAPICall();
    recordAPICall();
    
    const updatedRemaining = getRemainingCalls();
    await processAndDisplayData(shfeData, sfeData, updatedRemaining);
    
  } catch (error) {
    console.log(`获取数据失败: ${error}`);
    recordAPICall();
    recordAPICall();
    sendNotification("❌ 黄金数据获取失败", error.message, "");
  }
  
  $done();
}

// 获取交易所数据
async function getExchangeData(exchange) {
  const url = `${CONFIG.apiUrls[exchange]}?key=${CONFIG.apiKey}`;
  console.log(`请求 ${exchange} 数据: ${url}`);
  
  const response = await httpGet(url);
  
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

// 发送通知的兼容函数
function sendNotification(title, subtitle, content) {
  if (!CONFIG.notification.enable) return;
  
  if (typeof $notification !== 'undefined') {
    $notification.post(title, subtitle, content);
  }
  // 如果没有$notification，尝试其他方法
  else if (typeof $notify !== 'undefined') {
    $notify(title, subtitle, content);
  } else {
    console.log(`通知: ${title} - ${subtitle} - ${content}`);
  }
}

// 处理数据
async function processAndDisplayData(shfeData, sfeData, remainingCalls) {
  let content = "";
  let hasValidData = false;
  
  if (shfeData && shfeData.data) {
    const processed = processSHFEData(shfeData.data);
    if (processed) {
      content += "🏛️ 上海金交:\n" + processed + "\n";
      hasValidData = true;
    }
  }
  
  if (sfeData && sfeData.data) {
    const processed = processSFEData(sfeData.data);
    if (processed) {
      content += "📊 上海期货:\n" + processed;
      hasValidData = true;
    }
  }
  
  const usageInfo = `今日剩余: ${remainingCalls}次`;
  const updateTime = new Date().toLocaleTimeString();
  
  if (hasValidData) {
    sendNotification("📈 黄金价格", content, `更新时间: ${updateTime} | ${usageInfo}`);
  } else {
    sendNotification("📈 黄金市场", "当前无交易数据", `可能市场已收盘 | ${usageInfo}`);
  }
}

// 数据处理函数（保持不变）
function processSHFEData(data) {
  let content = "";
  try {
    if (Array.isArray(data)) {
      data.forEach(item => {
        const variety = item.variety || item.name || "未知品种";
        const price = item.latestpri || item.price || "N/A";
        const change = item.limit || item.changePercent || "N/A";
        if (variety !== "未知品种" && price !== "N/A") {
          content += `${variety}: ${price} (${change})\n`;
        }
      });
    } else if (typeof data === 'object') {
      const variety = data.variety || data.name || "未知品种";
      const price = data.latestpri || data.price || "N/A";
      const change = data.limit || data.changePercent || "N/A";
      if (variety !== "未知品种" && price !== "N/A") {
        content += `${variety}: ${price} (${change})\n`;
      }
    }
  } catch (error) {
    console.log("处理上海金交数据错误:", error);
  }
  return content || null;
}

function processSFEData(data) {
  let content = "";
  try {
    if (Array.isArray(data)) {
      data.forEach(item => {
        const variety = item.name || item.variety || "未知合约";
        const price = item.price || item.latestpri || "N/A";
        const change = item.changePercent || item.limit || "N/A";
        if (variety !== "未知合约" && price !== "N/A") {
          content += `${variety}: ${price} (${change})\n`;
        }
      });
    } else if (typeof data === 'object') {
      const variety = data.name || data.variety || "未知合约";
      const price = data.price || data.latestpri || "N/A";
      const change = data.changePercent || data.limit || "N/A";
      if (variety !== "未知合约" && price !== "N/A") {
        content += `${variety}: ${price} (${change})\n`;
      }
    }
  } catch (error) {
    console.log("处理上海期货数据错误:", error);
  }
  return content || null;
}

// 根据参数执行对应函数
function main() {
  const scriptType = typeof $argument !== "undefined" ? $argument : "all";
  console.log(`执行脚本类型: ${scriptType}`);
  
  switch (scriptType) {
    case "shfe":
      getSingleExchangeData("shfe");
      break;
    case "sfe":
      getSingleExchangeData("sfe");
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

// 单独获取单个交易所数据
async function getSingleExchangeData(exchange) {
  const remaining = getRemainingCalls();
  if (remaining <= 0) {
    sendNotification("📈 黄金数据", "今日API调用次数已用完", "请明天再试");
    $done();
    return;
  }
  
  try {
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
    
    sendNotification(title, content, `更新时间: ${new Date().toLocaleTimeString()} | 今日剩余: ${updatedRemaining}次`);
    
  } catch (error) {
    console.log(`获取 ${exchange} 数据失败: ${error}`);
    recordAPICall();
    sendNotification(`❌ ${exchange}数据获取失败`, error.message, "");
  }
  
  $done();
}

function checkAPIUsage() {
  const usage = getAPIUsage();
  const remaining = getRemainingCalls();
  const message = `今日已用: ${usage.count}次\n剩余次数: ${remaining}次`;
  sendNotification("📊 API使用情况", message, "黄金数据接口");
  $done();
}

// 启动脚本
main();
