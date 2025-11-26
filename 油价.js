// 油价查询脚本 for Loon - 使用天行数据API
// 接口: https://apis.tianapi.com/oilprice/index
// 请求方式: GET
// 返回类型: JSON

const API_KEY = "8fb6b3bc5bbe9ee420193601d13f9162"; // 替换为您的天行数据API Key
const TARGET_PROVINCE = "安徽"; // 设置要查询的省份

// 初始化年度历史记录
function initializeAnnualHistory() {
    const currentYear = new Date().getFullYear().toString();
    const lastYear = (parseInt(currentYear) - 1).toString();
    
    // 检查是否存在去年记录，如果有则存档
    const lastYearHistoryKey = `oil_price_history_${lastYear}`;
    const lastYearHistory = $persistentStore.read(lastYearHistoryKey);
    if (lastYearHistory) {
        console.log(`发现${lastYear}年度历史记录，共${JSON.parse(lastYearHistory).length}次调价`);
        // 可以在这里添加存档逻辑，比如重命名key等
    }
    
    // 确保当前年度记录存在
    const currentYearHistoryKey = `oil_price_history_${currentYear}`;
    const currentYearHistory = $persistentStore.read(currentYearHistoryKey);
    if (!currentYearHistory) {
        console.log(`初始化${currentYear}年度调价记录`);
        $persistentStore.write("[]", currentYearHistoryKey);
    } else {
        const records = JSON.parse(currentYearHistory);
        console.log(`${currentYear}年度已有${records.length}次调价记录`);
    }
}

// 显示年度调价历史
function displayAnnualHistory() {
    const currentYear = new Date().getFullYear().toString();
    const historyKey = `oil_price_history_${currentYear}`;
    const historyData = $persistentStore.read(historyKey);
    
    console.log(`\n=== ${currentYear}年度调价历史 ===`);
    
    if (historyData) {
        try {
            const historyRecords = JSON.parse(historyData);
            if (Array.isArray(historyRecords) && historyRecords.length > 0) {
                console.log(`共${historyRecords.length}次调价记录：`);
                historyRecords.forEach((record, index) => {
                    console.log(`\n${index + 1}. ${record.date}`);
                    if (record.changes && Object.keys(record.changes).length > 0) {
                        Object.values(record.changes).forEach(change => {
                            const diffIcon = change.diff > 0 ? "📈" : "📉";
                            const diffSign = change.diff > 0 ? "+" : "";
                            console.log(`   ${diffIcon} ${change.name}: ${change.lastPrice}→${change.currentPrice}(${diffSign}${change.diff.toFixed(2)})`);
                        });
                    } else {
                        console.log("   无价格变动");
                    }
                });
            } else {
                console.log("暂无调价记录");
            }
        } catch (e) {
            console.log(`解析调价历史记录时出错: ${e}`);
        }
    } else {
        console.log("暂无调价记录");
    }
    console.log("=====================\n");
}

function getOilPrice() {
    // 初始化年度历史记录
    initializeAnnualHistory();
    
    // 编码省份名称
    const encodedProvince = encodeURIComponent(TARGET_PROVINCE);
    
    // 构建API请求URL
    const url = `https://apis.tianapi.com/oilprice/index?key=${API_KEY}&prov=${encodedProvince}`;
    
    console.log("请求URL: " + url);
    
    // 使用Loon的$httpClient发送请求
    $httpClient.get(url, function(error, response, data) {
        if (error) {
            console.log("油价查询失败: " + error);
            $notification.post("油价查询失败", "网络请求错误", error);
            
            // 即使查询失败也显示历史记录
            displayAnnualHistory();
            $done();
            return;
        }
        
        try {
            const result = JSON.parse(data);
            
            // 检查API返回状态
            if (result.code !== 200) {
                console.log("API返回错误: " + JSON.stringify(result));
                $notification.post("油价查询失败", 
                                  `API错误: ${result.msg}`, 
                                  `错误码: ${result.code}`);
                
                // 即使API错误也显示历史记录
                displayAnnualHistory();
                $done();
                return;
            }
            
            // 提取油价信息
            const oilData = result.result;
            const currentYear = new Date().getFullYear().toString();
            
            // 获取上次保存的油价数据
            const lastOilData = $persistentStore.read("last_oil_price");
            let lastPriceInfo = null;
            let hasPriceChange = false;
            
            if (lastOilData) {
                try {
                    lastPriceInfo = JSON.parse(lastOilData);
                    console.log("上次油价数据:", lastPriceInfo);
                } catch (e) {
                    console.log("解析上次油价数据失败: " + e);
                }
            } else {
                console.log("无上次油价数据，首次运行");
            }
            
            // 检查是否有价格变动
            if (lastPriceInfo) {
                const oilTypes = ['p92', 'p95', 'p98', 'p0'];
                for (const type of oilTypes) {
                    if (oilData[type] && lastPriceInfo[type] && 
                        parseFloat(oilData[type]) !== parseFloat(lastPriceInfo[type])) {
                        hasPriceChange = true;
                        console.log(`检测到价格变动: ${type} ${lastPriceInfo[type]} → ${oilData[type]}`);
                        break;
                    }
                }
            } else {
                // 如果没有上次数据，视为首次运行，不记录为价格变动
                console.log("首次运行，不记录价格变动");
            }
            
            // 如果有价格变动，记录变动信息
            if (hasPriceChange) {
                const now = new Date();
                const changeRecord = {
                    timestamp: now.getTime(),
                    date: formatDateTime(now),
                    changes: {}
                };
                
                // 记录每个油品的变动情况
                const oilTypes = [
                    {key: 'p92', name: '92号汽油'},
                    {key: 'p95', name: '95号汽油'},
                    {key: 'p98', name: '98号汽油'},
                    {key: 'p0', name: '0号柴油'}
                ];
                
                oilTypes.forEach(type => {
                    if (oilData[type.key] && lastPriceInfo[type.key]) {
                        const currentPrice = parseFloat(oilData[type.key]);
                        const lastPrice = parseFloat(lastPriceInfo[type.key]);
                        const diff = currentPrice - lastPrice;
                        
                        if (diff !== 0) {
                            changeRecord.changes[type.key] = {
                                name: type.name,
                                lastPrice: lastPrice,
                                currentPrice: currentPrice,
                                diff: diff
                            };
                            console.log(`记录变动: ${type.name} ${lastPrice} → ${currentPrice} (${diff > 0 ? '+' : ''}${diff.toFixed(2)})`);
                        }
                    }
                });
                
                // 获取年度历史调价记录
                const historyKey = `oil_price_history_${currentYear}`;
                const historyData = $persistentStore.read(historyKey);
                let historyRecords = [];
                
                if (historyData) {
                    try {
                        historyRecords = JSON.parse(historyData);
                        if (!Array.isArray(historyRecords)) {
                            historyRecords = [];
                        }
                    } catch (e) {
                        console.log("解析历史调价记录失败: " + e);
                        historyRecords = [];
                    }
                }
                
                // 将新记录添加到历史记录中
                historyRecords.unshift(changeRecord);
                
                // 保存年度历史调价记录
                $persistentStore.write(JSON.stringify(historyRecords), historyKey);
                console.log(`[${currentYear}]油价变动已记录，当前共${historyRecords.length}次调价记录`);
                
            } else {
                console.log("无价格变动，无需记录");
            }
            
            // 保存当前油价数据
            const saveData = {
                province: TARGET_PROVINCE,
                p92: oilData.p92,
                p95: oilData.p95,
                p98: oilData.p98 || null,
                p0: oilData.p0,
                time: oilData.time || new Date().toLocaleDateString(),
                timestamp: new Date().getTime()
            };
            
            $persistentStore.write(JSON.stringify(saveData), "last_oil_price");
            console.log("当前油价数据已保存");
            
            // 构建通知消息
            let message = "";
            
            // 使用当前实时时间而不是API返回的时间
            const now = new Date();
            const currentDate = formatDateTime(now).split(' ')[0];
            const currentTime = formatDateTime(now).split(' ')[1];
            message += `⏰ ${currentDate} ${currentTime}`;
            
            // 获取最近一次调价记录
            const historyKey = `oil_price_history_${currentYear}`;
            const historyData = $persistentStore.read(historyKey);
            let latestChange = null;
            
            if (historyData) {
                try {
                    const historyRecords = JSON.parse(historyData);
                    if (Array.isArray(historyRecords) && historyRecords.length > 0) {
                        latestChange = historyRecords[0];
                    }
                } catch (e) {
                    console.log("解析历史调价记录失败: " + e);
                }
            }
            
            // 显示最近一次调价历史
            if (latestChange && latestChange.changes && Object.keys(latestChange.changes).length > 0) {
                message += "\n\n📊 最近调价";
                message += `\n🆕 ${latestChange.date.split(' ')[0]}`;
                
                const changes = latestChange.changes;
                const oilTypes = [
                    {key: 'p92', name: '92号汽油'},
                    {key: 'p95', name: '95号汽油'}, 
                    {key: 'p98', name: '98号汽油'},
                    {key: 'p0', name: '0号柴油'}
                ];
                
                oilTypes.forEach(type => {
                    if (changes[type.key]) {
                        const change = changes[type.key];
                        const diffIcon = change.diff > 0 ? "📈" : "📉";
                        const diffSign = change.diff > 0 ? "+" : "";
                        // 对齐显示格式
                        message += `\n${diffIcon} ${type.name}: ${change.lastPrice}→${change.currentPrice}(${diffSign}${change.diff.toFixed(2)})`;
                    }
                });
            }
            
            // 添加当前油价（紧凑格式）
            message += "\n\n⛽ 当前油价";
            const oilTypes = [
                {key: 'p92', name: '92号汽油'},
                {key: 'p95', name: '95号汽油'},
                {key: 'p98', name: '98号汽油'},
                {key: 'p0', name: '0号柴油'}
            ];
            
            oilTypes.forEach(type => {
                if (oilData[type.key]) {
                    const currentPrice = parseFloat(oilData[type.key]);
                    // 对齐显示格式，确保冒号对齐
                    const paddedName = type.name.padEnd(6, ' '); // 中文字符占2个英文字符宽度
                    message += `\n⛽️ ${paddedName}：¥${currentPrice.toFixed(2)}`;
                }
            });
            
            // 显示年度调价次数
            const currentYearHistory = $persistentStore.read(`oil_price_history_${currentYear}`);
            if (currentYearHistory) {
                try {
                    const records = JSON.parse(currentYearHistory);
                    if (records.length > 0) {
                        message += `\n\n📅 ${currentYear}年已调价${records.length}次`;
                    }
                } catch (e) {
                    // 忽略错误
                }
            }
            
            // 发送通知
            $notification.post(
                `${TARGET_PROVINCE}油价提醒`, // 标题
                "", // 子标题留空
                message // 内容
            );
            
        } catch (e) {
            console.log("油价查询失败: " + e.message);
            $notification.post("油价查询失败", "数据处理错误", e.message);
        } finally {
            // 无论成功与否，都显示年度历史记录
            displayAnnualHistory();
            $done();
        }
    });
}

// 格式化日期时间（精确到分钟）
function formatDateTime(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

// 执行主函数
getOilPrice();