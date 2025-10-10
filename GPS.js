// 名称: 精准苹果天气GPS定位
// 描述: 从WeatherKit API提取精确GPS坐标
// 作者: Assistant
// 更新时间: 2025-10-10

console.log("🎯 精准苹果天气GPS定位启动");

if (typeof $request !== "undefined") {
    console.log("📍 拦截到WeatherKit请求");
    console.log("📡 完整URL:", $request.url);
    
    try {
        const url = $request.url;
        
        if (url.includes("weatherkit.apple.com")) {
            // 精确匹配WeatherKit API的URL格式
            const pattern = /weatherkit\.apple\.com\/v2\/weather\/[^\/]+\/([0-9.-]+)\/([0-9.-]+)/;
            const res = url.match(pattern);
            
            if (res && res[1] && res[2]) {
                const lat = res[1];
                const lng = res[2];
                
                console.log(`🎯 成功提取坐标: ${lat}, ${lng}`);
                
                const locationData = {
                    latitude: parseFloat(lat),
                    longitude: parseFloat(lng),
                    source: "weatherkit_apple",
                    timestamp: new Date().getTime(),
                    accuracy: "high",
                    url: url
                };
                
                // 保存GPS数据
                $persistentStore.write(JSON.stringify(locationData), "accurate_gps_location");
                $persistentStore.write(Date.now().toString(), "location_timestamp");
                
                // 获取详细地址信息
                getAddressFromCoordinates(lat, lng)
                    .then(address => {
                        $notification.post(
                            "📍 GPS定位成功", 
                            `坐标: ${lat}, ${lng}`,
                            `位置: ${address.province}${address.city}${address.district}\n精度: 高精度GPS`
                        );
                    })
                    .catch(error => {
                        $notification.post(
                            "📍 GPS定位成功", 
                            `坐标: ${lat}, ${lng}`,
                            `时间: ${new Date().toLocaleTimeString()}\n来源: 苹果WeatherKit API`
                        );
                    });
                
                console.log("✅ 高精度GPS数据已保存");
                
            } else {
                console.log("❌ URL格式不匹配");
                $notification.post(
                    "❌ 坐标提取失败", 
                    "WeatherKit API格式变化",
                    `请联系开发者更新脚本\nURL: ${url.substring(0, 80)}...`
                );
            }
        }
        
    } catch (error) {
        console.log("❌ 拦截处理出错:", error);
        $notification.post("❌ 脚本执行错误", error.message, "");
    }
    
} else {
    // 定时任务模式 - 显示当前GPS状态
    const locationData = $persistentStore.read("accurate_gps_location");
    
    if (locationData) {
        try {
            const location = JSON.parse(locationData);
            const timeDiff = Math.round((Date.now() - location.timestamp) / 1000 / 60);
            
            console.log(`📊 当前GPS数据: ${location.latitude}, ${location.longitude}`);
            
            // 获取地址信息显示
            getAddressFromCoordinates(location.latitude, location.longitude)
                .then(address => {
                    $notification.post(
                        "📍 GPS定位状态", 
                        `${address.province}${address.city}${address.district}`,
                        `坐标: ${location.latitude}, ${location.longitude}\n更新时间: ${timeDiff}分钟前\n来源: ${location.source}`
                    );
                })
                .catch(error => {
                    $notification.post(
                        "📍 GPS定位状态", 
                        `坐标: ${location.latitude}, ${location.longitude}`,
                        `数据来源: ${location.source}\n更新时间: ${timeDiff}分钟前`
                    );
                });
            
        } catch (e) {
            console.log("❌ 数据解析失败:", e);
            $notification.post("❌ GPS数据解析失败", e.message, "");
        }
    } else {
        console.log("❌ 无GPS定位数据");
        $notification.post(
            "📍 GPS定位状态", 
            "等待定位数据",
            "请打开系统天气App触发GPS定位"
        );
    }
}

$done();

// 根据坐标获取地址信息
function getAddressFromCoordinates(lat, lng) {
    return new Promise((resolve, reject) => {
        const TENCENT_TOKEN = "F7NBZ-MC3R3-6AV3J-RR75X-KKDTE-EKFLQ";
        const geocoderUrl = `https://apis.map.qq.com/ws/geocoder/v1/?key=${TENCENT_TOKEN}&location=${lat},${lng}`;
        
        $httpClient.get(geocoderUrl, function(error, response, data) {
            if (error) {
                reject(error);
                return;
            }
            
            try {
                const result = JSON.parse(data);
                if (result.status === 0) {
                    const address = result.result.address_component;
                    resolve({
                        province: address.province,
                        city: address.city,
                        district: address.district,
                        street: address.street || ""
                    });
                } else {
                    reject(new Error("逆地理编码失败"));
                }
            } catch (e) {
                reject(e);
            }
        });
    });
}
