// 名称: 最终版GPS拦截
// 描述: 拦截天气GPS坐标并确保正常显示天气数据
// 作者: Assistant
// 版本: 2.3 - 优化通知版

console.log("🎯 GPS拦截脚本启动 - 优化版");

if (typeof $request !== "undefined") {
    console.log("✅ 拦截到天气请求:", $request.url);
    
    // 提取坐标 - 多种匹配模式
    const url = $request.url;
    let lat, lng;
    
    // 优化的URL模式匹配
    const patterns = [
        /weatherkit\.apple\.com\/v[12]\/weather\/[^\/]+\/([0-9.-]+)\/([0-9.-]+)/,
        /[?&]lat=([0-9.-]+)[^&]*[?&]l[on]*g=([0-9.-]+)/i,
        /[?&]latitude=([0-9.-]+)[^&]*[?&]longitude=([0-9.-]+)/i,
        /location=([0-9.-]+)%2C([0-9.-]+)/,
        /geo=([0-9.-]+),([0-9.-]+)/
    ];
    
    for (let pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1] && match[2]) {
            lat = parseFloat(match[1]).toFixed(6);
            lng = parseFloat(match[2]).toFixed(6);
            console.log(`🎯 使用模式匹配到坐标: ${lat}, ${lng}`);
            break;
        }
    }
    
    // 备用方案：尝试从请求头获取
    if (!lat && $request.headers) {
        const headers = $request.headers;
        if (headers['X-Latitude'] && headers['X-Longitude']) {
            lat = headers['X-Latitude'];
            lng = headers['X-Longitude'];
            console.log(`📡 从请求头获取坐标: ${lat}, ${lng}`);
        }
    }
    
    if (lat && lng) {
        console.log(`📍 成功提取坐标: ${lat}, ${lng}`);
        
        // 检查是否是新位置或长时间未更新
        const lastLocationData = $persistentStore.read("accurate_gps_location");
        let shouldNotify = true;
        let locationChangeType = "新位置";
        
        if (lastLocationData) {
            try {
                const lastLocation = JSON.parse(lastLocationData);
                const sameLocation = (lastLocation.latitude === lat && lastLocation.longitude === lng);
                const lastTime = parseInt($persistentStore.read("location_timestamp") || "0");
                const timeDiff = Date.now() - lastTime;
                const timeDiffMinutes = Math.floor(timeDiff / (60 * 1000));
                
                if (sameLocation) {
                    if (timeDiff < 10 * 60 * 1000) { // 10分钟内
                        shouldNotify = false;
                        locationChangeType = "相同位置（10分钟内）";
                        console.log("📍 相同位置，10分钟内已更新，跳过通知");
                    } else {
                        locationChangeType = "相同位置（超过10分钟）";
                        console.log(`📍 相同位置，但已超过${timeDiffMinutes}分钟`);
                    }
                } else {
                    locationChangeType = "位置已更新";
                    console.log(`📍 位置发生变化，上次: ${lastLocation.latitude}, ${lastLocation.longitude}`);
                }
            } catch (e) {
                console.log("❌ 解析历史位置数据失败:", e);
            }
        }
        
        // 保存GPS数据
        const locationData = {
            latitude: lat,
            longitude: lng,
            timestamp: Date.now(),
            source: "weatherkit_apple",
            accuracy: "high",
            url: url,
            userAgent: $request.headers?.['User-Agent'] || "unknown"
        };
        
        $persistentStore.write(JSON.stringify(locationData), "accurate_gps_location");
        $persistentStore.write(Date.now().toString(), "location_timestamp");
        
        console.log("💾 GPS数据已保存");
        
        // 发送通知（恢复通知功能）
        if (shouldNotify) {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('zh-CN', { 
                hour12: false, 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            const dateStr = now.toLocaleDateString('zh-CN');
            
            $notification.post(
                "📍 GPS定位成功", 
                `${locationChangeType}: ${lat}, ${lng}`,
                `时间: ${dateStr} ${timeStr}\n天气数据正常显示中...\n点击查看详情`
            );
            
            // 同时获取地址信息
            getAddressForNotification(lat, lng);
        }
        
    } else {
        console.log("❌ 未找到坐标信息");
        $notification.post(
            "⚠️ GPS拦截警告",
            "未提取到坐标",
            "请求URL: " + (url.length > 50 ? url.substring(0, 50) + "..." : url)
        );
    }
    
    // 关键：直接完成请求，确保天气App正常显示数据
    $done({});
    
} else {
    // 手动检查模式 - 增强功能
    console.log("📊 GPS状态检查 - 增强版");
    
    const locationData = $persistentStore.read("accurate_gps_location");
    const timestamp = $persistentStore.read("location_timestamp");
    
    if (locationData && timestamp) {
        try {
            const location = JSON.parse(locationData);
            const timeDiff = Date.now() - parseInt(timestamp);
            const timeDiffMinutes = Math.round(timeDiff / 60000);
            const timeDiffHours = Math.round(timeDiffMinutes / 60);
            
            console.log(`🌍 当前GPS数据: ${location.latitude}, ${location.longitude}`);
            
            // 获取详细地址信息
            getDetailedAddress(location.latitude, location.longitude, timeDiffMinutes);
            
        } catch (e) {
            console.log("❌ 数据解析失败:", e);
            $notification.post(
                "❌ GPS状态检查失败", 
                "数据解析错误",
                "错误信息: " + e.message
            );
            $done();
        }
    } else {
        console.log("❌ 无GPS定位数据");
        $notification.post(
            "📍 GPS定位状态", 
            "等待定位数据",
            "请打开系统天气App触发GPS定位\n或打开其他使用定位的App"
        );
        $done();
    }
}

// 获取地址信息用于通知
function getAddressForNotification(lat, lng) {
    const TENCENT_TOKEN = "F7NBZ-MC3R3-6AV3J-RR75X-KKDTE-EKFLQ";
    const geocoderUrl = `https://apis.map.qq.com/ws/geocoder/v1/?key=${TENCENT_TOKEN}&location=${lat},${lng}`;
    
    console.log("🗺️ 后台获取地址信息...");
    
    $httpClient.get(geocoderUrl, function(error, response, data) {
        if (!error && response.status === 200) {
            try {
                const result = JSON.parse(data);
                if (result.status === 0) {
                    const address = result.result.address_component;
                    let addressText = `${address.province || ''}${address.city || ''}${address.district || ''}`;
                    
                    // 保存地址信息
                    const locationData = JSON.parse($persistentStore.read("accurate_gps_location") || "{}");
                    locationData.address = addressText;
                    locationData.formatted_address = result.result.formatted_addresses?.recommend || result.result.address;
                    $persistentStore.write(JSON.stringify(locationData), "accurate_gps_location");
                    
                    console.log("✅ 地址信息已保存:", addressText);
                }
            } catch (e) {
                console.log("❌ 地址解析失败:", e);
            }
        }
    });
}

// 获取详细地址信息（用于手动检查）
function getDetailedAddress(lat, lng, timeDiffMinutes) {
    const TENCENT_TOKEN = "F7NBZ-MC3R3-6AV3J-RR75X-KKDTE-EKFLQ";
    const geocoderUrl = `https://apis.map.qq.com/ws/geocoder/v1/?key=${TENCENT_TOKEN}&location=${lat},${lng}`;
    
    console.log("🗺️ 获取详细地址信息...");
    
    $httpClient.get(geocoderUrl, function(error, response, data) {
        let addressText = "地址解析中...";
        let detailAddress = "";
        
        if (!error && response.status === 200) {
            try {
                const result = JSON.parse(data);
                if (result.status === 0) {
                    const address = result.result.address_component;
                    addressText = `${address.province || ''}${address.city || ''}${address.district || ''}`;
                    detailAddress = result.result.formatted_addresses?.recommend || result.result.address || addressText;
                    
                    // 添加街道信息
                    if (address.street) addressText += address.street;
                    if (address.street_number) addressText += address.street_number;
                    
                    console.log("✅ 地址解析成功:", addressText);
                } else {
                    addressText = "地址解析失败";
                    detailAddress = `错误码: ${result.status}`;
                }
            } catch (e) {
                addressText = "地址数据解析错误";
                detailAddress = e.message;
            }
        } else {
            addressText = "网络请求失败";
            detailAddress = error || `状态码: ${response?.status}`;
        }
        
        // 读取完整位置数据
        const locationData = JSON.parse($persistentStore.read("accurate_gps_location") || "{}");
        const sourceApp = locationData.userAgent || "未知应用";
        const timestamp = new Date(parseInt($persistentStore.read("location_timestamp") || Date.now().toString()));
        const updateTime = timestamp.toLocaleString('zh-CN');
        
        // 发送详细通知
        const body = `⏰ 更新时间: ${timeDiffMinutes}分钟前 (${updateTime})\n` +
                    `📍 经纬度: ${lat}, ${lng}\n` +
                    `📱 来源应用: ${sourceApp}\n\n` +
                    `🏠 详细地址:\n${detailAddress || addressText}\n\n` +
                    `🔍 点击可复制坐标`;
        
        $notification.post("📍 GPS定位状态", `坐标: ${lat}, ${lng}`, body);
        
        console.log(`📍 GPS定位状态 - 坐标: ${lat}, ${lng}`);
        console.log(`⏰ 更新时间: ${timeDiffMinutes}分钟前`);
        console.log(`🏠 详细地址: ${addressText}`);
        
        $done();
    });
}