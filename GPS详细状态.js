// 名称: Loon完整请求转发版GPS定位
// 描述: 提取GPS坐标、转发请求、显示详细地址
// 作者: Assistant
// 工具: Loon
// 更新时间: 2025-10-10

console.log("🎯 Loon完整请求转发版GPS定位启动");

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
                    source: "weatherkit_apple_full",
                    timestamp: new Date().getTime(),
                    accuracy: "high",
                    url: url
                };
                
                $persistentStore.write(JSON.stringify(locationData), "accurate_gps_location");
                $persistentStore.write(Date.now().toString(), "location_timestamp");
                
                console.log("✅ GPS数据已保存");
            }
        }
    } catch (error) {
        console.log("❌ 坐标提取失败:", error);
    }
    
    // 转发原始请求
    $httpClient.get({
        url: $request.url,
        headers: $request.headers
    }, function(error, response, data) {
        if (error) {
            console.log("❌ 请求转发失败:", error);
            $done();
        } else {
            console.log("✅ 请求转发成功，状态码:", response.status);
            
            // 请求转发成功后，获取详细地址并发送通知
            if (extractedLat && extractedLng) {
                getDetailedAddress(extractedLat, extractedLng);
            }
            
            // 返回响应给天气App
            $done({
                status: response.status,
                headers: response.headers,
                body: data
            });
        }
    });
    
} else {
    // 定时任务模式 - 显示详细GPS状态
    console.log("⏰ 详细GPS状态检查");
    
    const locationData = $persistentStore.read("accurate_gps_location");
    const timestamp = $persistentStore.read("location_timestamp");
    
    if (locationData && timestamp) {
        try {
            const location = JSON.parse(locationData);
            const timeDiff = Math.round((Date.now() - parseInt(timestamp)) / 1000 / 60);
            
            console.log(`🌍 当前GPS数据: ${location.latitude}, ${location.longitude}`);
            
            // 获取详细地址信息
            getDetailedAddress(location.latitude, location.longitude, timeDiff, location.source);
            
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

// 获取详细地址信息并发送通知
function getDetailedAddress(lat, lng, timeDiff = null, source = null) {
    const TENCENT_TOKEN = "F7NBZ-MC3R3-6AV3J-RR75X-KKDTE-EKFLQ";
    const geocoderUrl = `https://apis.map.qq.com/ws/geocoder/v1/?key=${TENCENT_TOKEN}&location=${lat},${lng}`;
    
    console.log("🗺️ 获取详细地址信息...");
    
    $httpClient.get(geocoderUrl, function(error, response, data) {
        let addressText = "";
        let subtitle = "";
        
        if (!error) {
            try {
                const result = JSON.parse(data);
                if (result.status === 0) {
                    const address = result.result.address_component;
                    addressText = `${address.province}${address.city}${address.district}`;
                    if (address.street) {
                        addressText += `${address.street}`;
                    }
                    if (address.street_number) {
                        addressText += `${address.street_number}`;
                    }
                    
                    subtitle = `📍 ${addressText}`;
                    console.log("✅ 地址解析成功:", addressText);
                } else {
                    addressText = "地址解析失败";
                    subtitle = `📍 坐标: ${lat}, ${lng}`;
                    console.log("❌ 逆地理编码失败");
                }
            } catch (e) {
                addressText = "地址数据解析错误";
                subtitle = `📍 坐标: ${lat}, ${lng}`;
                console.log("❌ 地址数据解析失败:", e);
            }
        } else {
            addressText = "网络请求失败";
            subtitle = `📍 坐标: ${lat}, ${lng}`;
            console.log("❌ 地址请求失败:", error);
        }
        
        // 构建通知内容
        let title = "📍 GPS定位成功";
        let body = "";
        
        if (timeDiff !== null && source !== null) {
            // 定时任务模式
            title = "📍 GPS定位状态";
            body += `⏰ 更新时间: ${timeDiff}分钟前\n`;
            body += `📡 数据来源: ${source}\n`;
        } else {
            // 实时拦截模式
            body += `⏰ 定位时间: ${new Date().toLocaleTimeString()}\n`;
        }
        
        body += `🌐 坐标精度: 高精度GPS\n`;
        body += `🌎 经纬度: ${lat}, ${lng}\n\n`;
        body += `🏠 详细地址:\n${addressText}`;
        
        // 发送详细通知
        $notification.post(title, subtitle, body);
        
        // 如果是定时任务模式，需要调用$done
        if (timeDiff !== null) {
            $done();
        }
    });
}
