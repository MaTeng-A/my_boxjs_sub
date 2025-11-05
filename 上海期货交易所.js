// 期货监控脚本 for Loon - 每小时运行版
const API_URL = "http://web.juhe.cn/finance/gold/shfuture";
const APP_KEY = "f24e2fa4068b20c4d44fbff66b7745de";

// 存储上次数据用于比较
let lastData = $persistentStore.read("futures_last_data");
if (!lastData) {
    lastData = {};
} else {
    lastData = JSON.parse(lastData);
}

function main() {
    console.log("🎯 开始获取期货数据...");
    
    const url = `${API_URL}?key=${APP_KEY}&v=1`;
    
    $httpClient.get({
        url: url,
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        timeout: 10000
    }, (error, response, data) => {
        if (error) {
            console.log("❌ 请求失败:", error);
            $notification.post(
                "📊 期货数据", 
                "网络请求失败", 
                "无法连接到期货数据接口\n请检查网络连接"
            );
            $done();
            return;
        }
        
        try {
            const jsonData = JSON.parse(data);
            
            if (jsonData.error_code !== 0) {
                console.log("❌ API错误:", jsonData.reason, "代码:", jsonData.error_code);
                $notification.post(
                    "📊 期货数据", 
                    "API接口错误", 
                    `错误原因: ${jsonData.reason}\n错误代码: ${jsonData.error_code}`
                );
                $done();
                return;
            }
            
            if (!jsonData.result || !Array.isArray(jsonData.result)) {
                console.log("❌ API返回数据格式异常");
                $notification.post(
                    "📊 期货数据", 
                    "数据格式异常", 
                    "API返回数据格式不正确\n请稍后重试"
                );
                $done();
                return;
            }
            
            // 处理期货数据
            processFuturesData(jsonData.result);
            
        } catch (e) {
            console.log("❌ 数据处理错误:", e);
            $notification.post(
                "📊 期货数据", 
                "数据处理错误", 
                "解析数据时发生错误\n请检查脚本配置"
            );
        }
        
        $done();
    });
}

function processFuturesData(resultArray) {
    console.log(`📊 获取到 ${resultArray.length} 个结果元素`);
    
    if (resultArray.length === 0) {
        console.log("❌ 结果数组为空");
        $notification.post(
            "📊 期货数据", 
            "当前休市", 
            "未获取到有效期货数据\n可能处于非交易时段"
        );
        return;
    }
    
    // 提取所有期货品种
    const allFutures = [];
    
    resultArray.forEach((item, index) => {
        console.log(`🔍 处理第 ${index + 1} 个结果元素，包含 ${Object.keys(item).length} 个品种`);
        
        // 遍历该元素中的所有品种
        Object.keys(item).forEach(futureKey => {
            const futureData = item[futureKey];
            if (futureData && futureData.name && futureData.latestpri) {
                allFutures.push({
                    key: futureKey,
                    data: futureData
                });
            }
        });
    });
    
    console.log(`📈 总共提取到 ${allFutures.length} 个有效期货品种`);
    
    if (allFutures.length === 0) {
        console.log("⚠️ 没有有效数据");
        $notification.post(
            "📊 期货数据", 
            "当前休市", 
            "未获取到有效期货数据\n可能处于非交易时段"
        );
        return;
    }
    
    // 检查数据时间有效性
    const validFutures = allFutures.filter(future => {
        return isDataTimeValid(future.data.time);
    });
    
    console.log(`🕒 时间有效的品种: ${validFutures.length}/${allFutures.length}`);
    
    if (validFutures.length === 0) {
        console.log("⚠️ 没有时间有效的数据");
        $notification.post(
            "📊 期货数据", 
            "数据已过期", 
            "当前数据非实时交易数据\n可能处于非交易时段"
        );
        return;
    }
    
    // 显示所有品种的详细信息
    displayAllFuturesDetails(validFutures);
    
    // 发送通知 - 主力合约
    sendMainFuturesNotifications(validFutures);
}

function displayAllFuturesDetails(futuresList) {
    console.log("=".repeat(80));
    console.log("📋 所有期货品种详细信息");
    console.log("=".repeat(80));
    
    futuresList.forEach((future, index) => {
        const data = future.data;
        const changePercent = calculateChangePercent(data.latestpri, data.lastclear, data.change);
        const changeNum = parseFloat(data.change);
        const arrow = isNaN(changeNum) ? "➡️" : (changeNum >= 0 ? "📈" : "📉");
        
        // 品种标题行
        console.log(`${arrow} ${(index + 1).toString().padStart(2, '0')}. ${future.key}`);
        
        // 最新价单独一行
        console.log(`   💰 最新价: ${data.latestpri}`);
        
        // 涨跌和涨跌幅在同一行
        console.log(`   📊 涨跌: ${data.change} (${changePercent})`);
        
        // 买卖盘信息在同一行
        console.log(`   🛒 买价: ${data.buypri || "N/A"} (${data.buyvol || "N/A"}手) | 🏪 卖价: ${data.sellpri || "N/A"} (${data.sellvol || "N/A"}手)`);
        
        // 开盘和结算信息
        console.log(`   📈 今开: ${data.open || "N/A"} | 📉 昨结: ${data.lastclear || "N/A"}`);
        
        // 最高最低价
        console.log(`   🔺 最高: ${data.maxpri || "N/A"} | 🔻 最低: ${data.minpri || "N/A"}`);
        
        // 成交量和持仓量
        console.log(`   📦 成交量: ${data.tradvol || "N/A"}手 | 🏷️ 持仓量: ${data.position || "N/A"}手`);
        
        // 增仓信息（如果有）
        if (data.zengcang && data.zengcang !== "") {
            console.log(`   📋 增仓: ${data.zengcang}手`);
        }
        
        // 更新时间
        console.log(`   🕒 更新时间: ${data.time}`);
        
        // 品种间分隔线
        if (index < futuresList.length - 1) {
            console.log("─".repeat(80));
        }
    });
    
    console.log("=".repeat(80));
    console.log(`📊 总计 ${futuresList.length} 个期货品种`);
}

function isDataTimeValid(dataTime) {
    if (!dataTime) return false;
    
    const dataDate = new Date(dataTime.replace(/-/g, '/'));
    const now = new Date();
    
    // 检查数据时间是否在最近30分钟内
    const timeDiff = (now - dataDate) / (1000 * 60);
    
    if (timeDiff > 30) {
        console.log(`⏰ 数据时间已过期: ${dataTime} (${timeDiff.toFixed(1)}分钟前)`);
        return false;
    }
    
    return true;
}

function calculateChangePercent(latest, lastClear, change) {
    if (!latest || !lastClear) return "N/A";
    
    const latestNum = parseFloat(latest);
    const lastClearNum = parseFloat(lastClear);
    
    if (isNaN(latestNum) || isNaN(lastClearNum) || lastClearNum === 0) {
        return "N/A";
    }
    
    if (change) {
        const changeNum = parseFloat(change);
        if (!isNaN(changeNum)) {
            const percent = (changeNum / lastClearNum) * 100;
            return (percent >= 0 ? "+" : "") + percent.toFixed(2) + "%";
        }
    }
    
    const percent = ((latestNum - lastClearNum) / lastClearNum) * 100;
    return (percent >= 0 ? "+" : "") + percent.toFixed(2) + "%";
}

function sendMainFuturesNotifications(futuresList) {
    // 筛选主力合约
    const mainFutures = futuresList.filter(future => 
        future.key.includes("连续")
    );
    
    console.log(`🎯 找到 ${mainFutures.length} 个主力合约`);
    
    if (mainFutures.length === 0) {
        console.log("⚠️ 未找到主力合约，发送前2个品种");
        sendLimitedNotifications(futuresList.slice(0, 2));
        return;
    }
    
    sendLimitedNotifications(mainFutures);
}

function sendLimitedNotifications(futuresList) {
    let notifiedCount = 0;
    const maxNotifications = 2;
    
    const currentData = {};
    
    futuresList.slice(0, maxNotifications).forEach((future, index) => {
        const futureKey = future.key;
        const futureData = future.data;
        
        currentData[futureKey] = JSON.stringify(futureData);
        
        try {
            sendSingleFutureNotification(futureKey, futureData);
            notifiedCount++;
        } catch (error) {
            console.log(`❌ 发送通知失败 [${futureKey}]:`, error);
        }
    });
    
    Object.assign(lastData, currentData);
    $persistentStore.write(JSON.stringify(lastData), "futures_last_data");
    
    console.log(`✅ 处理完成: 发送 ${notifiedCount} 个通知`);
}

function sendSingleFutureNotification(futureKey, data) {
    const name = data.name || futureKey;
    const latestPrice = data.latestpri || "N/A";
    const change = data.change || "0";
    const open = data.open || "N/A";
    const high = data.maxpri || "N/A";
    const low = data.minpri || "N/A";
    const volume = data.tradvol || "N/A";
    const lastClose = data.lastclear || "N/A";
    const buyPrice = data.buypri || "N/A";
    const buyVolume = data.buyvol || "N/A";
    const sellPrice = data.sellpri || "N/A";
    const sellVolume = data.sellvol || "N/A";
    const position = data.position || "N/A";
    const zengcang = data.zengcang || "N/A";
    const time = data.time || "未知";
    
    const dataFreshness = calculateDataFreshness(time);
    const changePercent = calculateChangePercent(latestPrice, lastClose, change);
    
    const changeNum = parseFloat(change);
    const arrow = isNaN(changeNum) ? "➡️" : (changeNum >= 0 ? "📈" : "📉");
    const changeText = isNaN(changeNum) ? change : (changeNum >= 0 ? `+${change}` : change);
    
    const title = `${arrow} ${name}`;
    const subtitle = `🕒 ${time.split(' ')[1]} • ${dataFreshness}`;
    
    let message = "";
    message += `💰 最新价: ${latestPrice}\n`;
    message += `📊 涨跌: ${changeText}`;
    if (changePercent !== "N/A") message += ` (${changePercent})`;
    message += `\n🛒 买盘: ${buyPrice} (${buyVolume}手)`;
    message += `\n🏪 卖盘: ${sellPrice} (${sellVolume}手)`;
    message += `\n📈 今开: ${open}`;
    if (lastClose !== "N/A") message += ` | 昨结: ${lastClose}`;
    message += `\n🎯 高低: ${high}/${low}`;
    if (volume !== "N/A") message += `\n📦 成交量: ${volume}手`;
    if (position !== "N/A") message += ` | 持仓: ${position}手`;
    if (zengcang !== "N/A" && zengcang !== "") message += `\n📋 增仓: ${zengcang}手`;
    
    if (dataFreshness.includes("前")) {
        message += `\n\n⚠️ 注意: 非实时交易数据`;
    }
    
    console.log(`📤 发送通知: ${name}`);
    $notification.post(title, subtitle, message);
}

function calculateDataFreshness(dataTime) {
    if (!dataTime) return "时间未知";
    
    const dataDate = new Date(dataTime.replace(/-/g, '/'));
    const now = new Date();
    const timeDiff = (now - dataDate) / (1000 * 60);
    
    if (timeDiff < 1) {
        return "刚刚更新";
    } else if (timeDiff < 60) {
        return `${Math.floor(timeDiff)}分钟前`;
    } else {
        return `${Math.floor(timeDiff / 60)}小时前`;
    }
}

// 执行主函数
main();