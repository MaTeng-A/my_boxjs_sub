// 名称: 高德地图定位分析器
// 描述: 分析高德地图的请求，找出包含坐标的请求
// 版本: 1.0
// 作者: Assistant

console.log("🔍 高德地图定位分析器启动");

if (typeof $request !== 'undefined') {
    const url = $request.url;
    
    // 只分析高德地图的请求
    if (url.includes('amap.com') || url.includes('gaode.com')) {
        console.log("\n" + "=".repeat(80));
        console.log("📡 分析高德地图请求");
        console.log("=".repeat(80));
        
        // 基本信息
        try {
            const urlObj = new URL(url);
            console.log(`🌐 域名: ${urlObj.hostname}`);
            console.log(`🛣️ 路径: ${urlObj.pathname}`);
            console.log(`🔗 完整URL: ${url.substring(0, 200)}${url.length > 200 ? '...' : ''}`);
        } catch (e) {
            console.log(`🔗 URL: ${url.substring(0, 200)}${url.length > 200 ? '...' : ''}`);
        }
        
        // 检查常见的定位关键词
        const locationKeywords = [
            'location', 'lat', 'lng', 'lon', 'latitude', 'longitude', 
            'coord', 'coordinate', 'point', 'pos', 'geocode', 'regeo',
            'position', 'address', 'geo', 'gps', 'lbs', 'map'
        ];
        
        console.log("\n🔑 检查定位关键词:");
        let foundKeywords = [];
        
        for (const keyword of locationKeywords) {
            if (url.toLowerCase().includes(keyword.toLowerCase())) {
                foundKeywords.push(keyword);
                console.log(`✅ 发现关键词: ${keyword}`);
                
                // 如果是location、lat、lng等，尝试提取坐标
                if (['location', 'lat', 'lng', 'lon', 'latitude', 'longitude', 'coord'].includes(keyword)) {
                    extractAndLogCoordinates(url, keyword);
                }
            }
        }
        
        // 检查查询参数
        console.log("\n📊 查询参数分析:");
        try {
            const urlObj = new URL(url);
            const params = urlObj.searchParams;
            
            params.forEach((value, key) => {
                console.log(`   ${key} = ${value.substring(0, 50)}${value.length > 50 ? '...' : ''}`);
                
                // 特别关注可能的坐标参数
                if (key.toLowerCase().includes('location') || 
                    key.toLowerCase().includes('lat') || 
                    key.toLowerCase().includes('lng') ||
                    key.toLowerCase().includes('lon') ||
                    key.toLowerCase().includes('coord')) {
                    console.log(`   ⭐ 重点关注参数: ${key}`);
                    
                    // 尝试解析坐标
                    if (value.includes(',') || value.includes('%2C')) {
                        const coords = value.split(/[,%2C]/);
                        if (coords.length >= 2) {
                            const coord1 = parseFloat(coords[0]);
                            const coord2 = parseFloat(coords[1]);
                            
                            if (!isNaN(coord1) && !isNaN(coord2)) {
                                console.log(`   📍 可能坐标: ${coord1}, ${coord2}`);
                                
                                // 检查是否在有效范围内
                                if (Math.abs(coord1) <= 90 && Math.abs(coord2) <= 180) {
                                    console.log(`   🎯 有效坐标范围检测: 可能是经纬度`);
                                    if (coord1 > 0 && coord1 < 60 && coord2 > 70 && coord2 < 140) {
                                        console.log(`   🇨🇳 大概率是中国坐标`);
                                    }
                                }
                            }
                        }
                    }
                }
            });
        } catch (e) {
            console.log("❌ 无法解析URL参数");
        }
        
        // 检查请求头
        if ($request.headers) {
            console.log("\n📋 相关请求头:");
            const relevantHeaders = ['Content-Type', 'User-Agent', 'Referer'];
            
            for (const header of relevantHeaders) {
                const value = $request.headers[header];
                if (value) {
                    console.log(`   ${header}: ${value.substring(0, 80)}${value.length > 80 ? '...' : ''}`);
                }
            }
        }
        
        // 请求方法
        console.log(`\n📤 请求方法: ${$request.method || 'GET'}`);
        
        // 判断是否为定位相关请求
        const isLocationRelated = foundKeywords.length > 0 || 
                                 url.includes('regeo') || 
                                 url.includes('geocode') ||
                                 url.includes('lbs') ||
                                 url.includes('location');
        
        if (isLocationRelated) {
            console.log("\n🎯 总结: 这是一个定位相关请求");
            console.log(`📌 发现${foundKeywords.length}个定位关键词: ${foundKeywords.join(', ')}`);
            
            // 保存这个请求的信息
            saveRequestForAnalysis(url, foundKeywords);
        } else {
            console.log("\n📝 总结: 这可能不是定位请求（只是常规请求）");
        }
        
        console.log("=".repeat(80) + "\n");
    }
    
    $done({});
} else {
    // 手动模式：查看分析结果
    console.log("📊 查看高德地图请求分析结果");
    
    const analyzedRequests = $persistentStore.read("amap_requests_analysis") || "[]";
    try {
        const requests = JSON.parse(analyzedRequests);
        
        if (requests.length === 0) {
            console.log("❌ 暂无分析数据，请打开高德地图进行操作");
            $notification.post("🔍 高德地图分析", "暂无数据", "请打开高德地图进行操作");
            $done();
            return;
        }
        
        console.log(`📈 已分析 ${requests.length} 个请求`);
        
        // 找出最可能的定位请求
        const locationRequests = requests.filter(req => 
            req.keywords && req.keywords.length > 0 && 
            (req.url.includes('regeo') || req.url.includes('geocode') || req.keywords.includes('location'))
        );
        
        if (locationRequests.length > 0) {
            console.log("\n🎯 最可能的定位请求:");
            locationRequests.slice(0, 3).forEach((req, index) => {
                console.log(`\n${index + 1}. ${req.hostname || '未知域名'}`);
                console.log(`   路径: ${req.pathname || '未知路径'}`);
                console.log(`   关键词: ${req.keywords.join(', ')}`);
                console.log(`   时间: ${new Date(req.timestamp).toLocaleTimeString()}`);
                
                if (req.potentialCoords) {
                    console.log(`   可能坐标: ${req.potentialCoords}`);
                }
            });
            
            // 发送通知
            const topRequest = locationRequests[0];
            $notification.post(
                "🔍 高德地图分析结果",
                `发现 ${locationRequests.length} 个定位请求`,
                `最新: ${topRequest.hostname}\n路径: ${topRequest.pathname}\n关键词: ${topRequest.keywords.join(', ')}`
            );
            
        } else {
            console.log("❌ 未发现明确的定位请求");
            $notification.post("🔍 高德地图分析", "未发现定位请求", "请尝试使用定位或搜索功能");
        }
        
    } catch (e) {
        console.log("❌ 分析数据解析失败:", e);
    }
    
    $done();
}

// 提取并记录坐标
function extractAndLogCoordinates(url, keyword) {
    // 尝试从URL中提取坐标
    let coords = null;
    
    if (keyword === 'location') {
        // 匹配 location=xxx,yyy 或 location=xxx%2Cyyy
        const locationMatch = url.match(/[?&]location=([0-9.-]+)[,%2C]([0-9.-]+)/);
        if (locationMatch) {
            coords = { lat: locationMatch[2], lng: locationMatch[1] }; // 注意：高德通常是经度,纬度
        }
    } else if (keyword === 'lat' || keyword === 'latitude') {
        // 匹配 lat=xxx&lng=yyy 或 lat=xxx&lon=yyy
        const latMatch = url.match(/[?&]lat(?:itude)?=([0-9.-]+)/i);
        const lngMatch = url.match(/[?&]l(?:ng|on)(?:gitude)?=([0-9.-]+)/i);
        
        if (latMatch && lngMatch) {
            coords = { lat: latMatch[1], lng: lngMatch[1] };
        }
    }
    
    if (coords) {
        console.log(`   📍 提取到坐标: ${coords.lat}, ${coords.lng}`);
        
        // 验证坐标有效性
        const latNum = parseFloat(coords.lat);
        const lngNum = parseFloat(coords.lng);
        
        if (!isNaN(latNum) && !isNaN(lngNum)) {
            if (Math.abs(latNum) <= 90 && Math.abs(lngNum) <= 180) {
                console.log(`   ✅ 有效坐标范围`);
                
                if (latNum > 3 && latNum < 54 && lngNum > 73 && lngNum < 136) {
                    console.log(`   🇨🇳 中国境内坐标`);
                    
                    // 获取地址
                    getAddressForCoords(latNum, lngNum);
                }
            } else {
                console.log(`   ❌ 无效坐标范围: 纬度应在[-90,90], 经度应在[-180,180]`);
            }
        }
    }
}

// 获取坐标地址（用于验证）
function getAddressForCoords(lat, lng) {
    const TENCENT_TOKEN = "F7NBZ-MC3R3-6AV3J-RR75X-KKDTE-EKFLQ";
    const geocoderUrl = `https://apis.map.qq.com/ws/geocoder/v1/?key=${TENCENT_TOKEN}&location=${lat},${lng}`;
    
    $httpClient.get(geocoderUrl, function(error, response, data) {
        if (!error && response.status === 200) {
            try {
                const result = JSON.parse(data);
                if (result.status === 0) {
                    const address = result.result.address_component;
                    console.log(`   🏠 地址验证: ${address.province || ''}${address.city || ''}${address.district || ''}`);
                }
            } catch (e) {
                // 忽略错误
            }
        }
    });
}

// 保存请求用于分析
function saveRequestForAnalysis(url, keywords) {
    try {
        const urlObj = new URL(url);
        
        const requestInfo = {
            url: url,
            hostname: urlObj.hostname,
            pathname: urlObj.pathname,
            keywords: keywords,
            timestamp: Date.now(),
            method: $request.method || 'GET'
        };
        
        // 尝试提取可能坐标
        if (url.includes('location=')) {
            const locationMatch = url.match(/[?&]location=([0-9.-]+)[,%2C]([0-9.-]+)/);
            if (locationMatch) {
                requestInfo.potentialCoords = `${locationMatch[1]}, ${locationMatch[2]}`;
            }
        }
        
        // 读取已有数据
        const existingData = $persistentStore.read("amap_requests_analysis") || "[]";
        const requests = JSON.parse(existingData);
        
        // 只保存最近的20个请求
        requests.unshift(requestInfo);
        if (requests.length > 20) {
            requests.pop();
        }
        
        $persistentStore.write(JSON.stringify(requests), "amap_requests_analysis");
        
    } catch (e) {
        console.log("❌ 保存请求分析失败:", e);
    }
}