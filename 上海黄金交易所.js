// 上海黄金交易所数据脚本 - 真实历史数据版
// 使用Loon的持久化存储来保存历史数据

const API_KEY = "f24e2fa4068b20c4d44fbff66b7745de";
const API_URL = "http://web.juhe.cn/finance/gold/shgold";

// Loon兼容延迟函数
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 获取或生成昨日数据
function getYesterdayData(todayData, variety) {
    // 从持久化存储中读取历史数据
    const historyKey = `gold_history_${variety}`;
    const historyData = $persistentStore.read(historyKey);
    
    if (historyData) {
        try {
            return JSON.parse(historyData);
        } catch (e) {
            console.log(`解析历史数据失败: ${e}`);
        }
    }
    
    // 如果没有历史数据，基于今日数据生成模拟数据
    return generateSimulatedYesterdayData(todayData);
}

// 保存今日数据作为明天的昨日数据
function saveTodayDataAsHistory(todayData, variety) {
    if (!todayData || !variety) return;
    
    const historyData = {
        open: formatNumber(todayData.openpri),
        high: formatNumber(todayData.maxpri),
        low: formatNumber(todayData.minpri),
        close: formatNumber(todayData.latestpri),
        change: todayData.limit || "--",
        time: getYesterdayDate(),
        variety: variety
    };
    
    // 只保存有效数据
    if (historyData.close !== "--" && historyData.open !== "--") {
        const historyKey = `gold_history_${variety}`;
        $persistentStore.write(JSON.stringify(historyData), historyKey);
        console.log(`已保存 ${variety} 的历史数据`);
    }
}

// 生成模拟的昨日数据（仅在无历史数据时使用）
function generateSimulatedYesterdayData(todayData) {
    const todayOpen = parseFloat(todayData.openpri);
    
    if (isNaN(todayOpen) || todayOpen <= 0) {
        return {
            open: "--",
            high: "--",
            low: "--",
            close: "--",
            change: "--",
            time: "暂无历史数据"
        };
    }
    
    // 基于今日开盘价模拟昨日数据
    const randomFactor = 0.98 + Math.random() * 0.04;
    
    const yesterdayClose = todayOpen;
    const yesterdayOpen = (yesterdayClose * (0.995 + Math.random() * 0.01)).toFixed(2);
    const yesterdayHigh = (yesterdayClose * (1 + Math.random() * 0.015)).toFixed(2);
    const yesterdayLow = (yesterdayClose * (0.985 - Math.random() * 0.01)).toFixed(2);
    
    const dayBeforeClose = (parseFloat(yesterdayOpen) * 0.995).toFixed(2);
    const yesterdayChange = ((yesterdayClose - dayBeforeClose) / dayBeforeClose * 100).toFixed(2);
    
    return {
        open: yesterdayOpen,
        high: yesterdayHigh,
        low: yesterdayLow,
        close: yesterdayClose.toFixed(2),
        change: (yesterdayChange >= 0 ? '+' : '') + yesterdayChange + '%',
        time: "模拟数据",
        note: "基于今日开盘价模拟"
    };
}

// 获取昨日日期
function getYesterdayDate() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toLocaleDateString('zh-CN');
}

(async () => {
    try {
        console.log("开始获取黄金数据...");
        
        const now = new Date();
        const goldData = await fetchGoldData();
        
        // 根据数据判断市场状态
        const isTradingTime = checkMarketStatusByData(goldData);
        console.log(`当前时间: ${now.toLocaleString('zh-CN')}`);
        console.log(`市场状态: ${isTradingTime ? '交易中' : '已收盘'}`);
        
        // 发送多个单独通知
        await sendMultipleNotifications(isTradingTime, now, goldData);
        
        console.log("所有通知发送完成");
        $done();
        
    } catch (error) {
        console.log("脚本错误: " + error);
        $notification.post(
            "🛎 上海黄金交易所", 
            "系统错误", 
            `错误信息: ${error}`
        );
        $done();
    }
})();

// 通过数据判断市场状态
function checkMarketStatusByData(apiData) {
    if (!apiData || !apiData.success || !apiData.data || apiData.data.length === 0) {
        console.log("无数据或数据获取失败，判断为休市");
        return false;
    }
    
    // 检查是否有品种有有效价格数据
    const hasValidData = apiData.data.some(item => {
        const price = parseFloat(item.latestpri);
        return !isNaN(price) && price > 0;
    });
    
    console.log(`数据有效性检查: ${hasValidData ? '有有效数据' : '无有效数据'}`);
    return hasValidData;
}

// 发送多个单独通知
async function sendMultipleNotifications(isTradingTime, currentTime, apiData) {
    const timeStr = currentTime.toLocaleString('zh-CN');
    const statusIcon = isTradingTime ? "🟢" : "🔴";
    const statusText = isTradingTime ? "交易中" : "已收盘";
    
    // 1. 合并市场状态和风险提示通知
    let marketMessage = `⏰ ${timeStr} ${statusIcon}\n`;
    marketMessage += `📊 市场状态: ${statusText}\n\n`;
    marketMessage += "⏰ 交易时间:\n";
    marketMessage += "• 日盘: 09:00-15:30\n";
    marketMessage += "• 夜盘: 20:00-02:30\n\n";
    
    if (!isTradingTime) {
        marketMessage += "💤 当前市场已收盘，显示最新参考数据\n\n";
    }
    
    // 添加风险提示到市场状态通知中
    marketMessage += "📋 风险等级说明:\n";
    marketMessage += "🟢 低风险(现货)\n🟡 中风险(迷你)\n🔴 高风险(杠杆)\n🔴🔴 极高风险(白银)\n\n";
    marketMessage += "🔄 自动更新: 每30分钟";
    
    $notification.post(
        "🛎 上海黄金交易所",
        `${statusText} • 市场概览`,
        marketMessage
    );
    
    console.log("合并市场状态通知已发送");
    
    // 等待1秒
    await delay(1000);
    
    // 2. 如果没有数据，发送错误通知
    if (!apiData || !apiData.success || !apiData.data || apiData.data.length === 0) {
        let errorMessage = "❌ 数据状态: ";
        if (!apiData) {
            errorMessage += "API请求未执行\n";
        } else if (!apiData.success) {
            errorMessage += `请求失败: ${apiData.error || '未知错误'}\n`;
        } else {
            errorMessage += "暂无关注品种数据\n";
        }
        
        $notification.post(
            "🛎 上海黄金交易所",
            "数据获取失败",
            errorMessage
        );
        console.log("错误通知已发送");
        return;
    }
    
    // 3. 为每个品种发送单独通知
    for (let i = 0; i < apiData.data.length; i++) {
        const item = apiData.data[i];
        await sendProductNotification(item, i + 1, apiData.data.length, isTradingTime);
        
        // 如果不是最后一个通知，等待1秒
        if (i < apiData.data.length - 1) {
            await delay(1000);
        }
    }
    
    // 4. 保存今日数据作为历史数据
    if (isTradingTime) {
        // 只在交易时间保存数据，避免保存收盘后的无效数据
        apiData.data.forEach(item => {
            saveTodayDataAsHistory(item, item.variety);
        });
    }
    
    console.log("所有品种通知发送完成");
}

// 发送单个品种通知
async function sendProductNotification(item, currentIndex, totalCount, isTradingTime) {
    const riskLevel = getRiskLevel(item.variety);
    const description = getProductDescription(item.variety);
    const riskIcon = getRiskIcon(riskLevel);
    
    // 处理可能的数据异常
    const latestPrice = formatNumber(item.latestpri);
    const limitChange = formatLimitChange(item.limit);
    const openPrice = formatNumber(item.openpri);
    const highPrice = formatNumber(item.maxpri);
    const lowPrice = formatNumber(item.minpri);
    
    // 判断趋势（如果有有效数据）
    let trendIcon = "➖"; // 默认中性
    if (limitChange !== '--' && limitChange !== 'NaN%') {
        const changeValue = parseFloat(limitChange);
        if (!isNaN(changeValue)) {
            trendIcon = changeValue < 0 ? "🔻" : "🔺";
        }
    }
    
    // 获取昨日真实数据
    const yesterdayData = getYesterdayData(item, item.variety);
    
    let message = `${riskIcon} ${item.variety} (${description})\n\n`;
    
    // 添加市场状态提示
    if (!isTradingTime) {
        message += "📌 注: 市场已收盘，以下为参考数据\n\n";
    }
    
    // 今日数据
    message += "📅 今日数据:\n";
    message += `💰 最新价格: ${latestPrice} ${trendIcon}\n`;
    message += `📈 涨跌幅: ${limitChange}\n`;
    message += `🔼 开盘: ${openPrice}\n`;
    message += `🔼 最高: ${highPrice}\n`;
    message += `🔽 最低: ${lowPrice}\n\n`;
    
    // 昨日数据 - 使用真实历史数据
    message += "📅 昨日数据:\n";
    message += `🔼 开盘: ${yesterdayData.open}\n`;
    message += `🔼 最高: ${yesterdayData.high}\n`;
    message += `🔽 最低: ${yesterdayData.low}\n`;
    message += `💰 收盘: ${yesterdayData.close}\n`;
    message += `📈 涨跌: ${yesterdayData.change}\n`;
    message += `⏰ 更新: ${yesterdayData.time}`;
    
    // 如果是模拟数据，添加说明
    if (yesterdayData.note) {
        message += ` (${yesterdayData.note})`;
    }
    
    message += `\n\n⏰ 今日更新: ${formatTime(item.time)}\n`;
    message += `📱 ${currentIndex}/${totalCount}`;
    
    $notification.post(
        "🛎 黄金行情",
        `${item.variety} ${latestPrice} ${trendIcon}`,
        message
    );
    
    console.log(`品种通知已发送: ${item.variety} (${currentIndex}/${totalCount})`);
}

// 新增：专门处理涨跌幅数据
function formatLimitChange(limit) {
    if (!limit || limit === '--') return '--';
    
    // 处理NaN%的情况
    if (limit === 'NaN%' || limit.includes('NaN')) {
        return '--';
    }
    
    // 尝试解析数字
    const num = parseFloat(limit);
    if (isNaN(num)) {
        return '--';
    }
    
    // 返回带符号的百分比
    return (num >= 0 ? '+' : '') + num.toFixed(2) + '%';
}

// 其余函数保持不变...
function fetchGoldData() {
    return new Promise((resolve) => {
        const url = `${API_URL}?key=${API_KEY}&v=1`;
        console.log("请求URL: " + url);
        
        $httpClient.get(url, (error, response, data) => {
            if (error) {
                console.log("请求错误: " + error);
                resolve({success: false, error: error});
                return;
            }
            
            try {
                console.log("API响应状态: " + response.status);
                const result = JSON.parse(data);
                
                if (result.error_code === 0) {
                    console.log("API返回数据成功");
                    
                    // 处理异常数据格式
                    const processedData = processApiData(result.result);
                    console.log("处理后的数据条数: "+ processedData.length);
                    
                    resolve({
                        success: true, 
                        data: processedData,
                        reason: result.reason
                    });
                } else {
                    console.log(`API错误: ${result.reason} (${result.error_code})`);
                    resolve({
                        success: false, 
                        error: result.reason,
                        errorCode: result.error_code
                    });
                }
            } catch (e) {
                console.log("数据解析错误: " + e);
                resolve({
                    success: false,
                    error: "数据解析失败: " + e
                });
            }
        });
    });
}

function processApiData(apiResult) {
    if (!apiResult) return [];
    
    console.log("原始API结果类型: " + typeof apiResult);
    
    let allProducts = [];
    
    // API返回的是一个数组，但第一个元素是一个包含所有品种的大对象
    if (Array.isArray(apiResult) && apiResult.length > 0) {
        const firstItem = apiResult[0];
        
        if (typeof firstItem === 'object') {
            // 提取对象中的所有值
            Object.values(firstItem).forEach(item => {
                if (item && typeof item === 'object' && item.variety) {
                    allProducts.push(item);
                }
            });
        }
    }
    
    console.log("提取到的总品种数: " + allProducts.length);
    
    // 修正品种名称映射
    const nameCorrections = {
        "Aug9.99": "Au99.99",
        "Aug9.95": "Au99.95", 
        "MAUTD": "mAu(T+D)",
        "Ag(7+D)": "Ag(T+D)",
        "Au(7+D)": "Au(T+D)",
        "Au1000": "Au100g"
    };
    
    // 应用名称修正
    allProducts.forEach(product => {
        if (nameCorrections[product.variety]) {
            console.log(`修正品种名称: ${product.variety} -> ${nameCorrections[product.variety]}`);
            product.variety = nameCorrections[product.variety];
        }
    });
    
    // 个人投资者关注的品种
    const targetProducts = ["Au99.99", "Au100g", "PGC30g", "Au(T+D)", "mAu(T+D)", "Ag(T+D)"];
    
    const filteredData = allProducts.filter(item => 
        targetProducts.includes(item.variety)
    );
    
    console.log("过滤后的关注品种数: " + filteredData.length);
    
    return filteredData;
}

// 辅助函数保持不变
function getRiskLevel(variety) {
    const riskMap = {
        "Au99.99": "low",
        "Au100g": "low", 
        "PGC30g": "low",
        "mAu(T+D)": "medium",
        "Au(T+D)": "high",
        "Ag(T+D)": "very-high"
    };
    return riskMap[variety] || "medium";
}

function getRiskIcon(riskLevel) {
    const iconMap = {
        "low": "🟢",
        "medium": "🟡", 
        "high": "🔴",
        "very-high": "🔴🔴"
    };
    return iconMap[riskLevel] || "🟡";
}

function getProductDescription(variety) {
    const descriptions = {
        "Au99.99": "标准现货黄金",
        "Au100g": "小规格金条", 
        "PGC30g": "熊猫金币",
        "Au(T+D)": "黄金延期",
        "mAu(T+D)": "迷你黄金",
        "Ag(T+D)": "白银延期"
    };
    return descriptions[variety] || "贵金属投资";
}

function formatNumber(value) {
    if (!value || value === '--' || value === 'NaN') return '--';
    const num = parseFloat(value);
    return isNaN(num) ? '--' : num.toFixed(2);
}

function formatTime(timeStr) {
    if (!timeStr) return '--';
    return timeStr.split(' ')[1] || timeStr;
}