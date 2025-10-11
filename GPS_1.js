// 名称: 天气GPS拦截修复版
// 描述: 确保天气数据正常显示的同时拦截GPS

console.log("🎯 天气GPS拦截修复版启动");

if (typeof $request !== "undefined") {
    console.log("📍 拦截到WeatherKit请求");
    console.log("📡 完整URL:", $request.url);
    
    // 提取GPS坐标
    let extractedLat, extractedLng;
    let shouldNotify = false;
    
    try {
        const url = $request.url;
        
        // 匹配GPS坐标的正则表达式
        const pattern = /weatherkit\.apple\.com\/v1\/weather\/([^\/]+)\/([0-9.-]+)\/([0-9.-]+)/;
        const res = url.match(pattern);
        
        if (res && res[2] && res[3]) {
            extractedLat = res[2];
            extractedLng = res[3];
            
            console.log(`🎯 成功提取坐标: ${extractedLat}, ${extractedLng}`);
            
            // 检查是否是新坐标
            const oldData = $persistentStore.read("gps_location");
            let isNewLocation = true;
            
            if (oldData) {
                try {
                    const oldLocation = JSON.parse(oldData);
                    if (oldLocation.latitude === extractedLat && oldLocation.longitude === extractedLng) {
                        isNewLocation = false;
                    }
                } catch (e) {}
            }
            
            if (isNewLocation) {
                // 保存GPS数据
                const locationData = {
                    latitude: extractedLat,
                    longitude: extractedLng,
                    timestamp: Date.now(),
                    source: "weatherkit"
                };
                
                $persistentStore.write(JSON.stringify(locationData), "gps_location");
                console.log("✅ GPS数据已保存");
                shouldNotify = true;
            }
        }
    } catch (error) {
        console.log("❌ 坐标提取失败:", error);
    }
    
    // 关键：直接完成请求，不进行转发
    // 这样可以确保天气App正常获取数据
    $done({});
    
    // 在请求完成后发送通知（避免影响请求）
    if (shouldNotify && extractedLat && extractedLng) {
        setTimeout(() => {
            $notification.post(
                "📍 GPS坐标已获取", 
                `纬度: ${extractedLat}, 经度: ${extractedLng}`,
                `时间: ${new Date().toLocaleTimeString()}`
            );
        }, 100);
    }
    
} else {
    // 手动检查模式
    console.log("📍 GPS状态检查");
    
    const gpsData = $persistentStore.read("gps_location");
    
    if (gpsData) {
        try {
            const location = JSON.parse(gpsData);
            const timeDiff = Math.round((Date.now() - location.timestamp) / 60000);
            
            // 获取详细地址
            getAddressDetails(location.latitude, location.longitude, timeDiff);
            
        } catch (e) {
            console.log("❌ 数据解析失败:", e);
            $notification.post("❌ GPS数据错误", "解析失败", e.message);
            $done();
        }
    } else {
        console.log("❌ 无GPS定位数据");
        $notification.post(
            "📍 无GPS数据", 
            "请打开天气App",
            "等待定位数据..."
        );
        $done();
    }
}

// 获取详细地址信息
function getAddressDetails(lat, lng, timeDiff) {
    const TENCENT_TOKEN = "F7NBZ-MC3R3-6AV3J-RR75X-KKDTE-EKFLQ";
    const geocoderUrl = `https://apis.map.qq.com/ws/geocoder/v1/?key=${TENCENT_TOKEN}&location=${lat},${lng}`;
    
    console.log("🗺️ 获取详细地址信息...");
    
    $httpClient.get(geocoderUrl, function(error, response, data) {
        let addressText = "地址解析中...";
        
        if (!error && response.status === 200) {
            try {
                const result = JSON.parse(data);
                if (result.status === 0) {
                    const address = result.result.address_component;
                    addressText = `${address.province}${address.city}${address.district}`;
                    if (address.street) addressText += `${address.street}`;
                    if (address.street_number) addressText += `${address.street_number}`;
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
        
        const body = `⏰ 更新时间: ${timeDiff}分钟前\n` +
                    `🌎 经纬度: ${lat}, ${lng}\n\n` +
                    `🏠 详细地址:\n${addressText}`;
        
        $notification.post("📍 GPS定位状态", `坐标: ${lat}, ${lng}`, body);
        $done();
    });
}