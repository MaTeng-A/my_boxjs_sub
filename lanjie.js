// 名称: 精准苹果天气GPS拦截
// 描述: 针对weatherkit.apple.com新API的GPS定位
// 作者: Assistant

console.log("🎯 精准苹果天气拦截启动");

if (typeof $request !== "undefined") {
    console.log("📍 拦截到weatherkit请求");
    console.log("📡 完整URL:", $request.url);
    
    try {
        const url = $request.url;
        
        if (url.includes("weatherkit.apple.com")) {
            console.log("✅ 确认为新苹果天气API");
            
            // 新的URL格式: /v2/weather/zh-Hans-CN/纬度/经度?...
            const pattern = /weatherkit\.apple\.com\/v2\/weather\/[^\/]+\/([0-9.-]+)\/([0-9.-]+)/;
            const res = url.match(pattern);
            
            if (res && res[1] && res[2]) {
                const lat = res[1];
                const lng = res[2];
                
                console.log(`🎯 成功提取坐标: ${lat}, ${lng}`);
                
                const locationData = {
                    latitude: parseFloat(lat),
                    longitude: parseFloat(lng),
                    source: "weatherkit_apple_v2",
                    timestamp: new Date().getTime(),
                    accuracy: "high",
                    url: url
                };
                
                // 保存GPS数据
                $persistentStore.write(JSON.stringify(locationData), "accurate_gps_location");
                $persistentStore.write(Date.now().toString(), "location_timestamp");
                
                // 获取地址信息
                getAddressFromCoordinates(lat, lng)
                    .then(address => {
                        $notification.post(
                            "📍 WeatherKit定位成功", 
                            `坐标: ${lat}, ${lng}`,
                            `位置: ${address.province}${address.city}${address.district}\n精度: 高`
                        );
                    })
                    .catch(error => {
                        $notification.post(
                            "📍 WeatherKit定位成功", 
                            `坐标: ${lat}, ${lng}`,
                            `时间: ${new Date().toLocaleTimeString()}\n新的苹果WeatherKit API`
                        );
                    });
                
                console.log("✅ 精准GPS数据已保存");
                
            } else {
                console.log("❌ URL格式不匹配");
                $persistentStore.write(url, "debug_last_url");
            }
        }
        
    } catch (error) {
        console.log("❌ 拦截处理出错:", error);
    }
    
    $done();
    
} else {
    // 定时任务模式 - 显示当前状态
    const locationData = $persistentStore.read("accurate_gps_location");
    
    if (locationData) {
        try {
            const location = JSON.parse(locationData);
            const timeDiff = Math.round((Date.now() - location.timestamp) / 1000 / 60);
            
            console.log(`📊 当前GPS数据: ${location.latitude}, ${location.longitude}`);
            
            $notification.post(
                "📍 GPS定位状态", 
                `坐标: ${location.latitude}, ${location.longitude}`,
                `数据来源: ${location.source}\n更新时间: ${timeDiff}分钟前`
            );
            
        } catch (e) {
            console.log("❌ 数据解析失败:", e);
        }
    } else {
        console.log("❌ 无GPS定位数据");
        $notification.post(
            "📍 GPS定位状态", 
            "等待拦截数据",
            "请打开天气App触发定位请求"
        );
    }
    
    $done();
}

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
                        street: address.street
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
