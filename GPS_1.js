// 名称: 天气GPS拦截（数据正常显示版）
// 描述: 拦截GPS坐标同时确保天气数据正常显示
// 作者: Assistant
// 工具: Loon

console.log("🎯 天气GPS拦截脚本启动");

if (typeof $request !== "undefined") {
    console.log("📍 拦截到WeatherKit请求");
    console.log("📡 完整URL:", $request.url);
    
    // 提取GPS坐标
    let extractedLat, extractedLng;
    
    try {
        const url = $request.url;
        
        if (url.includes("weatherkit.apple.com")) {
            const pattern = /weatherkit\.apple\.com\/v2\/weather\/[^\/]+\/([0-9.-]+)\/([0-9.-]+)/;
            const res = url.match(pattern);
            
            if (res && res[1] && res[2]) {
                extractedLat = res[1];
                extractedLng = res[2];
                
                console.log(`🎯 成功提取坐标: ${extractedLat}, ${extractedLng}`);
                
                // 保存GPS数据
                const locationData = {
                    latitude: parseFloat(extractedLat),
                    longitude: parseFloat(extractedLng),
                    source: "weatherkit_apple",
                    timestamp: new Date().getTime(),
                    accuracy: "high",
                    url: url
                };
                
                $persistentStore.write(JSON.stringify(locationData), "accurate_gps_location");
                $persistentStore.write(Date.now().toString(), "location_timestamp");
                
                console.log("✅ GPS数据已保存");
                
                // 立即发送坐标通知（可选）
                sendQuickLocationNotification(extractedLat, extractedLng);
            }
        }
    } catch (error) {
        console.log("❌ 坐标提取失败:", error);
    }
    
    // 关键：转发原始请求，确保天气App正常显示数据
    $httpClient.get({
        url: $request.url,
        headers: $request.headers
    }, function(error, response, data) {
        if (error) {
            console.log("❌ 请求转发失败:", error);
            $done();
        } else {
            console.log("✅ 请求转发成功，天气数据正常返回");
            
            // 返回原始响应给天气App，确保数据正常显示
            $done({
                status: response.status,
                headers: response.headers,
                body: data
            });
        }
    });
    
} else {
    // 手动检查模式 - 显示当前GPS状态
    console.log("📍 GPS状态检查");
    
    const locationData = $persistentStore.read("accurate_gps_location");
    const timestamp = $persistentStore.read("location_timestamp");
    
    if (locationData && timestamp) {
        try {
            const location = JSON.parse(locationData);
            const timeDiff = Math.round((Date.now() - parseInt(timestamp)) / 1000 / 60);
            
            console.log(`🌍 当前GPS数据: ${location.latitude}, ${location.longitude}`);
            
            // 获取详细地址信息
            getDetailedAddress(location.latitude, location.longitude, timeDiff);
            
        } catch (e) {
            console.log("❌ 数据解析失败:", e);
            $notification.post("❌ GPS状态检查失败", "数据解析错误", e.message);
            $done();
        }
    } else {
        console.log("❌ 无GPS定位数据");
        $notification.post(
            "📍 GPS定位状态", 
            "等待定位数据",
            "请打开系统天气App触发GPS定位"
        );
        $done();
    }
}

// 快速发送坐标通知（不等待地址解析）
function sendQuickLocationNotification(lat, lng) {
    $notification.post(
        "📍 GPS坐标已拦截",
        `纬度: ${lat}, 经度: ${lng}`,
        `时间: ${new Date().toLocaleTimeString()}\n天气App数据正常显示中...`
    );
}

// 获取详细地址信息
function getDetailedAddress(lat, lng, timeDiff = null) {
    const TENCENT_TOKEN = "F7NBZ-MC3R3-6AV3J-RR75X-KKDTE-EKFLQ";
    const geocoderUrl = `https://apis.map.qq.com/ws/geocoder/v1/?key=${TENCENT_TOKEN}&location=${lat},${lng}`;
    
    console.log("🗺️ 获取详细地址信息...");
    
    $httpClient.get(geocoderUrl, function(error, response, data) {
        let addressText = "地址解析中...";
        
        if (!error) {
            try {
                const result = JSON.parse(data);
                if (result.status === 0) {
                    const address = result.result.address_component;
                    addressText = `${address.province}${address.city}${address.district}`;
                    if (address.street) addressText += `${address.street}`;
                    if (address.street_number) addressText += `${address.street_number}`;
                    console.log("✅ 地址解析成功:", addressText);
                }
            } catch (e) {
                addressText = "地址解析失败";
                console.log("❌ 地址数据解析失败:", e);
            }
        } else {
            addressText = "网络请求失败";
            console.log("❌ 地址请求失败:", error);
        }
        
        // 发送详细通知
        const body = `⏰ 更新时间: ${timeDiff}分钟前\n` +
                    `🌎 经纬度: ${lat}, ${lng}\n\n` +
                    `🏠 详细地址:\n${addressText}`;
        
        $notification.post("📍 GPS定位状态", `坐标: ${lat}, ${lng}`, body);
        $done();
    });
}