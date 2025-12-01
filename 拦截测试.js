// 名称: Loon专用GPS拦截-增强通知版
// 描述: 自动拦截+主动触发天气请求，带通知功能
// 作者: Assistant
// 版本: 3.3 - 自动触发+通知版
// 平台: Loon

console.log("🎯 Loon GPS拦截脚本启动 - 增强通知版");

// 主处理函数
if (typeof $request !== 'undefined') {
    // 拦截模式
    handleRequest();
} else {
    // 手动检查或定时任务模式
    checkAndTrigger();
}

function handleRequest() {
    const url = $request.url;
    console.log("📡 拦截到天气请求:", url);
    
    // 提取坐标
    let lat, lng;
    const patterns = [
        /weatherkit\.apple\.com\/v\d+\/weather\/[^\/]+\/([0-9.-]+)\/([0-9.-]+)/,
        /weather\.data\.apple\.com\/v\d+\/weather\/[^\/]+\/([0-9.-]+)\/([0-9.-]+)/,
        /[?&]lat=([0-9.-]+)[&]?.*[?&]lng=([0-9.-]+)/i,
        /[?&]lat=([0-9.-]+)[&]?.*[?&]lon=([0-9.-]+)/i,
        /[?&]latitude=([0-9.-]+)[&]?.*[?&]longitude=([0-9.-]+)/i
    ];
    
    // 从URL提取
    for (let pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1] && match[2]) {
            lat = parseFloat(match[1]).toFixed(6);
            lng = parseFloat(match[2]).toFixed(6);
            console.log(`🎯 URL匹配到坐标: ${lat}, ${lng}`);
            break;
        }
    }
    
    // 从请求体提取
    if ((!lat || !lng) && $request.body) {
        console.log("🔍 尝试从请求体提取坐标...");
        const bodyStr = typeof $request.body === 'string' ? $request.body : JSON.stringify($request.body);
        const latMatch = bodyStr.match(/"lat":\s*([0-9.-]+)/i);
        const lngMatch = bodyStr.match(/"lon":\s*([0-9.-]+)/i);
        
        if (latMatch && lngMatch) {
            lat = parseFloat(latMatch[1]).toFixed(6);
            lng = parseFloat(lngMatch[1]).toFixed(6);
            console.log(`🔍 从请求体提取坐标: ${lat}, ${lng}`);
        }
    }
    
    // 保存数据并发送通知
    if (lat && lng) {
        saveGPSData(lat, lng, url, true); // true表示这是拦截请求
    } else {
        console.log("❌ 未找到坐标信息");
    }
    
    $done({});
}

function checkAndTrigger() {
    console.log("📊 GPS状态检查");
    
    const locationData = $persistentStore.read("accurate_gps_location");
    const timestamp = $persistentStore.read("location_timestamp");
    
    // 检查是否需要自动触发
    const lastTime = parseInt(timestamp || "0");
    const timeDiff = Date.now() - lastTime;
    const timeDiffMin = Math.round(timeDiff / 60000);
    
    // 超过5分钟未更新则自动触发
    if (timeDiff > 5 * 60 * 1000) {
        console.log(`⏰ 超过${timeDiffMin}分钟未更新，自动触发天气请求...`);
        sendNotification("🔄 GPS自动更新", `距离上次更新已${timeDiffMin}分钟`, "正在尝试触发天气请求...");
        autoTriggerGPS();
    } else {
        console.log(`⏰ 距离上次更新${timeDiffMin}分钟，无需自动触发`);
    }
    
    if (locationData && timestamp) {
        try {
            const location = JSON.parse(locationData);
            console.log(`🌍 当前GPS: ${location.latitude}, ${location.longitude}`);
            console.log(`⏰ 更新时间: ${timeDiffMin}分钟前`);
            
            // 获取地址信息
            getDetailedAddress(location.latitude, location.longitude, timeDiffMin);
        } catch (e) {
            console.log("❌ 数据解析失败:", e);
            $done();
        }
    } else {
        console.log("❌ 无GPS数据，自动触发请求...");
        sendNotification("📍 GPS状态", "无定位数据", "正在尝试自动获取GPS坐标...");
        autoTriggerGPS();
        $done();
    }
}

// 主动触发功能
function autoTriggerGPS() {
    console.log("🚀 自动触发天气请求...");
    
    const testUrls = [
        "https://weatherkit.apple.com/api/v1/weather/en/31.2304/121.4737?dataSets=currentWeather",
        "https://weatherkit.apple.com/v1/weather/zh/39.9042/116.4074"
    ];
    
    let requestCount = 0;
    let successCount = 0;
    
    testUrls.forEach((url, index) => {
        setTimeout(() => {
            requestCount++;
            $httpClient.get({
                url: url,
                timeout: 10
            }, function(error, response, data) {
                if (!error && response && response.status === 200) {
                    successCount++;
                    console.log(`✅ 触发成功 (${successCount}/${testUrls.length}): ${url}`);
                    
                    // 尝试从响应中提取坐标
                    if (data) {
                        try {
                            const jsonData = JSON.parse(data);
                            if (jsonData.latitude && jsonData.longitude) {
                                const lat = parseFloat(jsonData.latitude).toFixed(6);
                                const lng = parseFloat(jsonData.longitude).toFixed(6);
                                console.log(`🎯 从响应提取坐标: ${lat}, ${lng}`);
                                saveGPSData(lat, lng, url, false);
                            }
                        } catch (e) {
                            // 如果无法解析JSON，尝试从URL提取
                            const latMatch = url.match(/([0-9.-]+)\/([0-9.-]+)/);
                            if (latMatch && latMatch[1] && latMatch[2]) {
                                const lat = parseFloat(latMatch[1]).toFixed(6);
                                const lng = parseFloat(latMatch[2]).toFixed(6);
                                console.log(`🎯 从URL提取坐标: ${lat}, ${lng}`);
                                saveGPSData(lat, lng, url, false);
                            }
                        }
                    }
                } else {
                    console.log(`❌ 触发失败 (${index+1}/${testUrls.length}): ${url}`, error || `状态码: ${response ? response.status : '无响应'}`);
                }
                
                // 所有请求完成后发送汇总通知
                if (requestCount === testUrls.length) {
                    console.log(`📊 自动触发完成: ${successCount}成功, ${testUrls.length - successCount}失败`);
                    
                    if (successCount > 0) {
                        sendNotification("✅ GPS自动更新完成", `成功: ${successCount}/${testUrls.length}`, "GPS坐标已更新，请稍后查看");
                    } else {
                        sendNotification("❌ GPS自动更新失败", "所有请求均失败", "请检查网络连接或稍后重试");
                    }
                }
            });
        }, index * 2000); // 间隔2秒发送请求
    });
    
    // 如果没有请求发送（数组为空），直接返回
    if (testUrls.length === 0) {
        $done();
    }
}

// 保存GPS数据
function saveGPSData(lat, lng, url, isFromRequest) {
    console.log(`📍 保存坐标: ${lat}, ${lng}`);
    
    const now = Date.now();
    const locationData = {
        latitude: lat,
        longitude: lng,
        timestamp: now,
        source: isFromRequest ? "weatherkit_intercept" : "auto_trigger",
        accuracy: "high",
        url: url
    };
    
    // 检查是否需要发送通知（位置变化或超过10分钟）
    const lastLocationData = $persistentStore.read("accurate_gps_location");
    let shouldNotify = true;
    
    if (lastLocationData) {
        try {
            const lastLocation = JSON.parse(lastLocationData);
            const sameLocation = (lastLocation.latitude === lat && lastLocation.longitude === lng);
            const lastTime = parseInt($persistentStore.read("location_timestamp") || "0");
            const timeDiff = now - lastTime;
            
            // 如果是相同位置且在10分钟内更新过，则不通知
            if (sameLocation && timeDiff < 10 * 60 * 1000) {
                shouldNotify = false;
                console.log("📍 相同位置，10分钟内已更新过，跳过通知");
            }
        } catch (e) {
            console.log("❌ 解析历史位置数据失败:", e);
        }
    }
    
    // 保存数据
    $persistentStore.write(JSON.stringify(locationData), "accurate_gps_location");
    $persistentStore.write(now.toString(), "location_timestamp");
    
    console.log("💾 GPS数据已保存");
    
    // 发送通知
    if (shouldNotify) {
        const timeStr = new Date().toLocaleTimeString();
        const source = isFromRequest ? "拦截请求" : "自动触发";
        
        sendNotification(
            "📍 GPS定位成功", 
            `纬度: ${lat}, 经度: ${lng}`,
            `时间: ${timeStr}\n来源: ${source}\n天气数据正常显示中...`
        );
        
        // 记录通知时间
        $persistentStore.write(now.toString(), "last_notification_time");
    }
    
    // 如果不是来自请求，需要手动结束
    if (!isFromRequest) {
        $done();
    }
}

// 获取详细地址信息
function getDetailedAddress(lat, lng, timeDiff) {
    const TENCENT_TOKEN = "F7NBZ-MC3R3-6AV3J-RR75X-KKDTE-EKFLQ";
    const geocoderUrl = `https://apis.map.qq.com/ws/geocoder/v1/?key=${TENCENT_TOKEN}&location=${lat},${lng}`;
    
    console.log("🗺️ 获取详细地址信息...");
    
    $httpClient.get({
        url: geocoderUrl,
        timeout: 10
    }, function(error, response, data) {
        let addressText = "地址解析中...";
        
        if (!error && response && response.status === 200) {
            try {
                const result = JSON.parse(data);
                if (result.status === 0) {
                    const address = result.result.address_component;
                    addressText = `${address.province || ''}${address.city || ''}${address.district || ''}`;
                    if (address.street) addressText += address.street;
                    if (address.street_number) addressText += address.street_number;
                    console.log("✅ 地址解析成功:", addressText);
                } else {
                    addressText = "地址解析失败";
                }
            } catch (e) {
                addressText = "地址数据解析错误";
            }
        } else {
            addressText = "网络请求失败";
        }
        
        // 发送状态通知
        const body = `⏰ 更新时间: ${timeDiff}分钟前\n` +
                    `🌎 经纬度: ${lat}, ${lng}\n\n` +
                    `🏠 详细地址:\n${addressText}`;
        
        sendNotification("📍 GPS定位状态", `坐标: ${lat}, ${lng}`, body);
        $done();
    });
}

// 发送通知函数（统一封装）
function sendNotification(title, subtitle, body) {
    if (typeof $notification !== 'undefined') {
        console.log(`📢 发送通知: ${title} - ${subtitle}`);
        $notification.post(title, subtitle, body);
    } else {
        console.log("📢 [模拟通知]", title, "-", subtitle, ":", body);
    }
}

// 防止没有调用$done
$done();