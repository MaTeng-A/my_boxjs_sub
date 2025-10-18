// 油价查询脚本 for Loon - 使用天行数据API
// 接口: https://apis.tianapi.com/oilprice/index
// 请求方式: GET
// 返回类型: JSON

const API_KEY = "8fb6b3bc5bbe9ee420193601d13f9162"; // 替换为您的天行数据API Key
const TARGET_PROVINCE = "安徽"; // 设置要查询的省份

function getOilPrice() {
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
                $done();
                return;
            }
            
            // 提取油价信息
            const oilData = result.result;
            
            // 获取上次保存的油价数据
            const lastOilData = $persistentStore.read("last_oil_price");
            let lastPriceInfo = null;
            let hasPriceChange = false;
            
            if (lastOilData) {
                try {
                    lastPriceInfo = JSON.parse(lastOilData);
                } catch (e) {
                    console.log("解析上次油价数据失败: " + e);
                }
            }
            
            // 检查是否有价格变动
            if (lastPriceInfo) {
                const oilTypes = ['p92', 'p95', 'p98', 'p0'];
                for (const type of oilTypes) {
                    if (oilData[type] && lastPriceInfo[type] && 
                        parseFloat(oilData[type]) !== parseFloat(lastPriceInfo[type])) {
                        hasPriceChange = true;
                        break;
                    }
                }
            }
            
            // 如果有价格变动，记录变动信息
            if (hasPriceChange) {
                const changeRecord = {
                    date: oilData.time || new Date().toLocaleDateString(),
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
                        }
                    }
                });
                
                // 获取历史调价记录
                const historyData = $persistentStore.read("oil_price_change_history");
                let historyRecords = [];
                
                if (historyData) {
                    try {
                        historyRecords = JSON.parse(historyData);
                        // 确保historyRecords是数组
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
                
                // 只保留最近两次调价记录
                if (historyRecords.length > 2) {
                    historyRecords = historyRecords.slice(0, 2);
                }
                
                // 保存历史调价记录
                $persistentStore.write(JSON.stringify(historyRecords), "oil_price_change_history");
                console.log("油价变动已记录: " + JSON.stringify(changeRecord));
            }
            
            // 保存当前油价数据
            const saveData = {
                province: TARGET_PROVINCE,
                p92: oilData.p92,
                p95: oilData.p95,
                p98: oilData.p98 || null,
                p0: oilData.p0,
                time: oilData.time || new Date().toLocaleDateString()
            };
            
            $persistentStore.write(JSON.stringify(saveData), "last_oil_price");
            
            // 构建消息 - 紧凑格式
            let message = "";
            
            // 添加日期时间（紧接在标题下方，使用⏰图标）
            if (oilData.time) {
                message += `⏰${oilData.time}`;
            }
            
            // 获取历史调价记录
            const historyData = $persistentStore.read("oil_price_change_history");
            let historyRecords = [];
            
            if (historyData) {
                try {
                    historyRecords = JSON.parse(historyData);
                } catch (e) {
                    console.log("解析历史调价记录失败: " + e);
                }
            }
            
            // 如果有调价记录，显示调价历史
            if (historyRecords.length > 0) {
                message += "\n\n📊调价历史:";
                
                historyRecords.forEach((record, index) => {
                    const changes = record.changes;
                    const changedTypes = Object.keys(changes);
                    
                    if (changedTypes.length > 0) {
                        // 使用不同图标表示最近两次调价
                        const recordIcon = index === 0 ? "🆕" : "🔄";
                        message += `\n${recordIcon}${record.date}:`;
                        
                        // 显示所有油品的变动情况
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
                                message += `\n  ${diffIcon}${change.name}: ${change.lastPrice}→${change.currentPrice}(${diffSign}${change.diff.toFixed(2)})`;
                            }
                        });
                        
                        // 如果不是最后一次记录，添加空行分隔
                        if (index < historyRecords.length - 1) {
                            message += "\n";
                        }
                    }
                });
            }
            
            // 添加各型号当前油价
            message += "\n\n当前油价:";
            const oilTypes = [
                {key: 'p92', name: '92号汽油'},
                {key: 'p95', name: '95号汽油'},
                {key: 'p98', name: '98号汽油'},
                {key: 'p0', name: '0号柴油'}
            ];
            
            oilTypes.forEach(type => {
                if (oilData[type.key]) {
                    const currentPrice = parseFloat(oilData[type.key]);
                    message += `\n⛽${type.name}：¥${currentPrice}`;
                }
            });
            
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
            $done();
        }
    });
}

// 执行主函数
getOilPrice();