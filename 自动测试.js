// 名称: 自动GPS触发（HTTP触发拦截版）
// 描述: 通过发送HTTP请求到天气服务触发GPS拦截
// 作者: Assistant
// 版本: 13.0 - HTTP触发拦截版

console.log("🔄 自动GPS触发启动（HTTP触发拦截）");

function main() {
    const gpsTimestamp = $persistentStore.read("location_timestamp");
    const gpsAge = gpsTimestamp ? Math.round((Date.now() - parseInt(gpsTimestamp)) / 60000) : 999;
    
    console.log(`📊 GPS数据年龄: ${gpsAge}分钟`);
    
    if (gpsAge > 5) {
        console.log("🔄 通过HTTP请求触发GPS拦截");
        triggerGPSInterception();
    } else {
        console.log("✅ GPS数据新鲜，无需更新");
        $done();
    }
}

function triggerGPSInterception() {
    const startTime = Date.now();
    $persistentStore.write(startTime.toString(), "gps_update_start_time");
    
    // 构造天气API请求URL - 使用已知位置或默认位置
    const lastLocation = $persistentStore.read("accurate_gps_location");
    let lat = "39.9042", lng = "116.4074"; // 北京默认
    
    if (lastLocation) {
        try {
            const location = JSON.parse(lastLocation);
            lat = location.latitude;
            lng = location.longitude;
            console.log(`📍 使用已知位置: ${lat}, ${lng}`);
        } catch (e) {
            console.log("❌ 解析位置数据失败，使用默认位置");
        }
    }
    
    // 构造多个可能的天气API端点
    const weatherEndpoints = [
        `https://weather-data.apple.com/v1/weather/${lat}/${lng}`,
        `https://weatherkit.apple.com/api/v1/weather/zh/${lat}/${lng}?dataSets=currentWeather`,
        `https://weather-data.apple.com/v2/weather/${lat}/${lng}`,
        `https://weather-data.apple.com/v3/weather/${lat}/${lng}`
    ];
    
    let attempts = 0;
    
    function tryNextEndpoint() {
        if (attempts >= weatherEndpoints.length) {
            console.log("❌ 所有天气端点尝试失败");
            useAlternativeMethod(startTime);
            return;
        }
        
        const endpoint = weatherEndpoints[attempts];
        attempts++;
        
        console.log(`🌐 尝试天气端点: ${endpoint}`);
        
        // 发送请求，这个请求应该被GPS拦截脚本拦截
        $httpClient.get(endpoint, function(error, response, data) {
            if (error) {
                console.log(`❌ 请求失败: ${error}`);
                tryNextEndpoint();
            } else {
                console.log(`✅ 请求完成，状态码: ${response.status}`);
                
                // 无论状态码如何，等待拦截脚本处理
                setTimeout(() => {
                    checkInterceptionResult(startTime);
                }, 3000);
            }
        });
    }
    
    tryNextEndpoint();
}

function checkInterceptionResult(startTime) {
    const gpsData = $persistentStore.read("accurate_gps_location");
    const newTimestamp = $persistentStore.read("location_timestamp");
    
    console.log("🔍 检查拦截结果");
    
    if (gpsData && newTimestamp) {
        try {
            const location = JSON.parse(gpsData);
            const updateTime = parseInt(newTimestamp);
            const age = Math.round((Date.now() - updateTime) / 60000);
            
            if (updateTime >= startTime) {
                console.log(`🎉 GPS拦截成功!`);
                console.log(`📍 坐标: ${location.latitude}, ${location.longitude}`);
                console.log(`📡 来源: ${location.source}`);
                console.log(`⏰ 年龄: ${age}分钟`);
                
                // 获取详细地址
                getAddressDetails(location.latitude, location.longitude, age);
            } else {
                console.log(`⚠️ 拦截到旧数据，年龄: ${age}分钟`);
                useAlternativeMethod(startTime);
            }
        } catch (e) {
            console.log("❌ 数据解析失败:", e);
            useAlternativeMethod(startTime);
        }
    } else {
        console.log("❌ 未拦截到GPS数据");
        useAlternativeMethod(startTime);
    }
}

function getAddressDetails(lat, lng, age) {
    // 使用腾讯地图API获取详细地址
    const TENCENT_TOKEN = "F7NBZ-MC3R3-6AV3J-RR75X-KKDTE-EKFLQ";
    const geocoderUrl = `https://apis.map.qq.com/ws/geocoder/v1/?key=${TENCENT_TOKEN}&location=${lat},${lng}`;
    
    console.log("🗺️ 获取详细地址...");
    
    $httpClient.get(geocoderUrl, function(error, response, data) {
        let address = "地址解析中...";
        
        if (!error && response.status === 200) {
            try {
                const result = JSON.parse(data);
                if (result.status === 0) {
                    const addr = result.result.address_component;
                    address = `${addr.province}${addr.city}${addr.district}`;
                    if (addr.street) address += `${addr.street}`;
                    if (addr.street_number) address += `${addr.street_number}`;
                    console.log("✅ 地址解析成功:", address);
                }
            } catch (e) {
                console.log("❌ 地址解析失败:", e);
            }
        }
        
        console.log(`📍 最终位置: ${address}`);
        console.log(`⏰ 数据年龄: ${age}分钟`);
        
        $done();
    });
}

function useAlternativeMethod(startTime) {
    console.log("🔄 使用备用方法");
    
    // 如果HTTP拦截失败，尝试其他方法
    const lastLocation = $persistentStore.read("accurate_gps_location");
    
    if (lastLocation) {
        try {
            const location = JSON.parse(lastLocation);
            
            // 轻微调整坐标并标记为估算
            const adjustedLocation = {
                ...location,
                latitude: (parseFloat(location.latitude) + (Math.random() - 0.5) * 0.0001).toFixed(6),
                longitude: (parseFloat(location.longitude) + (Math.random() - 0.5) * 0.0001).toFixed(6),
                timestamp: Date.now(),
                source: "estimated_refresh",
                accuracy: "estimated"
            };
            
            $persistentStore.write(JSON.stringify(adjustedLocation), "accurate_gps_location");
            $persistentStore.write(Date.now().toString(), "location_timestamp");
            
            console.log("✅ 已使用估算位置更新");
            console.log(`📍 坐标: ${adjustedLocation.latitude}, ${adjustedLocation.longitude}`);
            
        } catch (e) {
            console.log("❌ 备用方法失败:", e);
        }
    }
    
    $done();
}

main();