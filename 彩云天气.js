// 名称: 稳定精准天气日报 (GPS增强版)
// 描述: 基于苹果WeatherKit GPS定位，包含诗句和明日预报
// 作者: Assistant
// 更新时间: 2025-10-10
// 修改: GPS永久有效，移除IP定位，修复显示问题，优化对齐

// === API 配置 ===
const CAIYUN_TOKEN = "iaJd9yTvsg3496vi";
const TENCENT_TOKEN = "F7NBZ-MC3R3-6AV3J-RR75X-KKDTE-EKFLQ";
const TIANAPI_KEY1 = "8fb6b3bc5bbe9ee420193601d13f9162";
const TIANAPI_KEY2 = "8fb6b3bc5bbe9ee420193601d13f9162";

// === 主函数 ===
function main() {
    console.log("🌤️ 开始获取天气信息...");
    
    // 只使用GPS定位 - 使用拦截脚本的键名
    const gpsData = $persistentStore.read("accurate_gps_location");
    
    if (gpsData) {
        try {
            const location = JSON.parse(gpsData);
            console.log("✅ 使用高精度GPS定位");
            console.log(`📍 GPS坐标: ${location.latitude}, ${location.longitude}`);
            
            // 使用GPS坐标获取地址信息
            getAddressFromGPSCoordinates(location.latitude, location.longitude)
                .then(address => {
                    getCaiyunWeather(
                        location.latitude, 
                        location.longitude, 
                        address.province, 
                        address.city, 
                        address.district
                    );
                })
                .catch(error => {
                    console.log("❌ 地址获取失败，使用坐标直接获取天气:", error);
                    getCaiyunWeather(location.latitude, location.longitude, "", "", "");
                });
            return;
        } catch (e) {
            console.log("❌ GPS定位数据解析失败:", e);
            handleError("GPS定位失败", "GPS数据格式错误，请确保GPS拦截脚本正常运行");
        }
    } else {
        console.log("❌ 未找到GPS定位数据");
        handleError("定位失败", "未找到GPS定位数据，请确保GPS拦截脚本已启用并运行");
    }
}

// === 根据GPS坐标获取地址信息 ===
function getAddressFromGPSCoordinates(lat, lng) {
    return new Promise((resolve, reject) => {
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

// === 获取彩云天气 ===
function getCaiyunWeather(lat, lng, province, city, district) {
    const weatherUrl = `https://api.caiyunapp.com/v2.6/${CAIYUN_TOKEN}/${lng},${lat}/weather?alert=true`;
    
    console.log("⏳ 获取彩云天气数据...");
    
    $httpClient.get(weatherUrl, function(error, response, data) {
        if (error) {
            handleError("天气获取失败", error);
            return;
        }
        
        try {
            const weatherData = JSON.parse(data);
            if (weatherData.status === "ok") {
                console.log("✅ 天气数据获取成功");
                
                // 检查是否是22:17及之后
                const isLastRun = isLastRunTime();
                console.log(`最后运行时段(22:17及之后): ${isLastRun}`);
                
                if (isLastRun) {
                    // 22:17及之后：先发送今日天气预报，然后间隔1秒发送明日天气预报
                    console.log("🕙 22:17最后一次运行，发送双通知");
                    
                    // 先发送今日天气预报
                    getTianapiData(weatherData, province, city, district, true);
                    
                    // 间隔1秒后发送明日天气预报
                    setTimeout(() => {
                        processTomorrowWeather(weatherData, province, city, district);
                    }, 1000);
                    
                } else {
                    // 正常时段显示当天天气+诗句
                    getTianapiData(weatherData, province, city, district, false);
                }
                
            } else {
                handleError("天气获取失败", weatherData.error || "未知错误");
            }
        } catch (e) {
            handleError("天气数据解析失败", e.message);
        }
    });
}

// === 获取天行数据（诗句）===
function getTianapiData(weatherData, province, city, district, isLastRun) {
    const skycon = weatherData.result.realtime.skycon;
    const tqtype = getTianapiWeatherType(skycon);
    
    let poetryUrl = `https://api.tianapi.com/tianqishiju/index?key=${TIANAPI_KEY1}`;
    if (tqtype) {
        poetryUrl += `&tqtype=${tqtype}`;
        console.log(`📜 使用指定天气类型: ${tqtype}`);
    } else {
        console.log("📜 使用随机天气诗句");
    }
    
    console.log("📜 获取天气诗句...");
    
    $httpClient.get(poetryUrl, function(error, response, poetryData) {
        let poetry = "今日天气宜人，愿您心情舒畅。";
        if (!error) {
            try {
                const poetryJson = JSON.parse(poetryData);
                if (poetryJson.code === 200 && poetryJson.newslist && poetryJson.newslist.length > 0) {
                    poetry = poetryJson.newslist[0].content;
                    console.log("✅ 天气诗句获取成功");
                }
            } catch (e) {
                console.log("❌ 天气诗句获取失败");
            }
        }
        
        // 处理当天天气数据
        processTodayWeather(weatherData, province, city, district, poetry, isLastRun);
    });
}

// === 处理当天天气数据 ===
function processTodayWeather(weatherData, province, city, district, poetry, isLastRun) {
    try {
        const realtime = weatherData.result.realtime;
        const hourly = weatherData.result.hourly;
        const daily = weatherData.result.daily;
        const alert = weatherData.result.alert;
        const keypoint = weatherData.result.forecast_keypoint;
        
        // 当前天气数据
        const temperature = Math.round(realtime.temperature);
        const apparentTemperature = Math.round(realtime.apparent_temperature);
        const humidity = Math.round(realtime.humidity * 100);
        const windSpeed = Math.round(realtime.wind.speed);
        const windDirection = getWindDirection(realtime.wind.direction);
        const pressure = Math.round(realtime.pressure / 100);
        const visibility = (realtime.visibility / 1000).toFixed(1);
        const skycon = realtime.skycon;
        const weatherDesc = getWeatherDescription(skycon);
        const airQuality = realtime.air_quality ? realtime.air_quality.description.chn : "未知";
        const pm25 = realtime.air_quality ? Math.round(realtime.air_quality.pm25) : "未知";
        
        // 生活指数
        const comfort = realtime.life_index.comfort ? realtime.life_index.comfort.desc : "暂无数据";
        const ultraviolet = realtime.life_index.ultraviolet ? realtime.life_index.ultraviolet.desc : "暂无数据";
        
        // 今日温度范围
        const maxTemp = Math.round(daily.temperature[0].max);
        const minTemp = Math.round(daily.temperature[0].min);
        
        // 获取天气图标
        const weatherIconUrl = getWeatherIcon(skycon);
        
        // 构建通知内容 - 始终使用"诗意天气日报"标题
        const title = "🌤️ 诗意天气日报";
        
        // 显示定位来源
        const gpsData = $persistentStore.read("accurate_gps_location");
        let locationSource = "📍";
        if (gpsData) {
            const location = JSON.parse(gpsData);
            if (location.source === "weatherkit_apple_full") {
                locationSource = "📍📡"; // GPS图标+信号图标
            }
        }
        
        const subtitle = `${locationSource}${province}${city}${district}（${minTemp}℃~${maxTemp}℃）| ${temperature}℃ | ${weatherDesc}`;
        
        let body = "";
        
        // 空气质量信息
        body += `🌫️ 空气质量：${airQuality}   🫧 PM2.5: ${pm25}\n`;
        body += `🌡️ 体感${comfort} ${apparentTemperature}℃   💧 湿度 ${humidity}%\n`;
        body += `🌬️ ${windDirection}风 ${windSpeed}km/h   📊 气压 ${pressure}hPa\n`;
        body += `👁️ 能见度 ${visibility}km   ☀️ 紫外线${ultraviolet}\n\n`;
        
        // 未来三小时预报
        let hourlyForecast = "";
        for (let i = 0; i < 3 && i < hourly.skycon.length; i++) {
            const hourTime = new Date(hourly.skycon[i].datetime);
            const currentHour = hourTime.getHours();
            const nextHour = currentHour + 1;
            const temp = Math.round(hourly.temperature[i].value);
            const hourSkycon = hourly.skycon[i].value;
            const hourDesc = getWeatherDescription(hourSkycon);
            
            hourlyForecast += `     ${currentHour.toString().padStart(2, '0')}-${nextHour.toString().padStart(2, '0')}时 ${hourDesc} ${temp}℃\n`;
        }
        
        if (hourlyForecast) {
            body += `⏰ 未来三小时预报:\n${hourlyForecast}\n`;
        }
        
        // 预警信息
        if (alert && alert.content && alert.content.length > 0) {
            body += "⚠️ 天气预警:\n";
            alert.content.forEach((alertItem, index) => {
                if (index < 2) {
                    body += `   • ${alertItem.title}\n`;
                }
            });
            body += "\n";
        }
        
        // 关键点内容
        if (keypoint) {
            body += `💡 ${keypoint}\n`;
        }
        
        // 诗句
        body += `📜 ${poetry}`;
        
        console.log("✅ 准备发送当天天气通知");
        
        // 发送通知
        $notification.post(title, subtitle, body, {
            "icon": weatherIconUrl
        });
        
        // 如果不是最后一次运行，则结束脚本
        if (!isLastRun) {
            $done();
        }
        
    } catch (e) {
        handleError("天气数据处理失败", e.message);
    }
}

// === 处理明日天气预报 ===
function processTomorrowWeather(weatherData, province, city, district) {
    try {
        const daily = weatherData.result.daily;
        const realtime = weatherData.result.realtime;
        
        // 安全检查：确保有足够的数据
        if (!daily.temperature || daily.temperature.length < 2) {
            throw new Error("天气数据不足，无法获取明日预报");
        }
        
        // 获取第二天天气信息
        const tomorrowTemp = daily.temperature[1];
        const tomorrowMaxTemp = Math.round(tomorrowTemp.max);
        const tomorrowMinTemp = Math.round(tomorrowTemp.min);
        const tomorrowSkycon = daily.skycon[1].value;
        const tomorrowWeatherDesc = getWeatherDescription(tomorrowSkycon);
        
        // 获取第二天的风力和风向信息（安全检查）
        let avgWindSpeed = 0;
        let windDirection = "未知";
        let windLevel = "未知";
        
        if (daily.wind && daily.wind.length > 1) {
            const tomorrowWindSpeed = daily.wind[1];
            avgWindSpeed = Math.round(tomorrowWindSpeed.avg.speed);
            windDirection = getSimpleWindDirection(tomorrowWindSpeed.avg.direction);
            windLevel = getWindLevel(avgWindSpeed);
        }
        
        // 获取未来三天天气信息（安全检查）
        const futureDays = [];
        const maxDays = Math.min(3, daily.temperature.length - 1); // 确保不超过数据范围
        
        for (let i = 1; i <= maxDays; i++) {
            const dayTemp = daily.temperature[i];
            const daySkycon = daily.skycon[i].value;
            const dayMaxTemp = Math.round(dayTemp.max);
            const dayMinTemp = Math.round(dayTemp.min);
            const dayWeatherDesc = getWeatherDescription(daySkycon);
            
            // 获取星期几
            const dayDate = new Date();
            dayDate.setDate(dayDate.getDate() + i);
            const dayWeekday = getWeekday(dayDate.getDay());
            
            futureDays.push({
                weekday: dayWeekday,
                weatherDesc: dayWeatherDesc,
                minTemp: dayMinTemp,
                maxTemp: dayMaxTemp
            });
        }
        
        // 日出日落时间（安全检查）
        let sunriseTime = "--:--";
        let sunsetTime = "--:--";
        if (daily.astro && daily.astro.length > 1) {
            sunriseTime = daily.astro[1].sunrise.time;
            sunsetTime = daily.astro[1].sunset.time;
        }
        
        // 穿衣建议和健康提示
        const dressingAdvice = getDressingAdvice(tomorrowMaxTemp, tomorrowWeatherDesc);
        const healthAdvice = getHealthAdvice(tomorrowMinTemp, tomorrowMaxTemp);
        const activityAdvice = getActivityAdvice(tomorrowWeatherDesc);
        
        // 季节安全提示
        const seasonSafetyTip = getSeasonSafetyTip();
        
        // 总体评价
        const overallAssessment = getOverallAssessment(tomorrowWeatherDesc, tomorrowMinTemp, tomorrowMaxTemp);
        
        // 获取明日天气图标
        const tomorrowWeatherIconUrl = getWeatherIcon(tomorrowSkycon);
        
        const title = "🌙 明日天气预告";
        const subtitle = `📍${province}${city}${district} 明日（${futureDays[0].weekday}）`;
        
        let body = "";
        
        // 天气概况 - 移除重复的温度行
        body += `🌡️ 气温: ${tomorrowMinTemp}℃ ~ ${tomorrowMaxTemp}℃\n`;
        body += `🌈 天气: ${tomorrowWeatherDesc}\n`;
        body += `🌬️ 风力: ${windLevel} ${windDirection}风 ${avgWindSpeed}km/h\n`;
        body += `🌅 日出: ${sunriseTime}   🌇 日落: ${sunsetTime}\n\n`;
        
        // 温馨提示要点
        body += "💡 温馨提示要点:\n";
        body += `• ${dressingAdvice}\n`;
        body += `• ${healthAdvice}\n`;
        body += `• ${activityAdvice}\n\n`;
        
        // 未来天气趋势
        body += "📈 未来天气趋势:\n";
        for (let i = 0; i < futureDays.length; i++) {
            const day = futureDays[i];
            body += `• ${day.weekday}: ${day.weatherDesc}，${day.minTemp}℃~${day.maxTemp}℃\n`;
        }
        body += "\n";
        
        // 安全提示
        body += `📍 ${seasonSafetyTip}\n\n`;
        
        // 总体评价
        body += `💡 ${overallAssessment}`;
        
        console.log("✅ 准备发送明日天气预报");
        
        // 发送通知
        $notification.post(title, subtitle, body, {
            "icon": tomorrowWeatherIconUrl
        });
        
        $done();
        
    } catch (e) {
        handleError("明日天气数据处理失败", e.message);
    }
}

// === 辅助函数 ===

// 检查是否是22:17及之后
function isLastRunTime() {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    return hour > 22 || (hour === 22 && minute >= 17);
}

// 天气图标映射 - 恢复原脚本的图标
function getWeatherIcon(skycon) {
    const iconMap = {
        "CLEAR_DAY": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/CLEAR_DAY.gif",
        "CLEAR_NIGHT": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/CLEAR_NIGHT.gif",
        "PARTLY_CLOUDY_DAY": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/PARTLY_CLOUDY_DAY.gif",
        "PARTLY_CLOUDY_NIGHT": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/PARTLY_CLOUDY_NIGHT.gif",
        "CLOUDY": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/CLOUDY.gif",
        "LIGHT_RAIN": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/LIGHT_RAIN.gif",
        "MODERATE_RAIN": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/MODERATE_RAIN.gif",
        "HEAVY_RAIN": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/HEAVY_RAIN.gif",
        "STORM_RAIN": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/STORM_RAIN.gif",
        "LIGHT_SNOW": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/LIGHT_SNOW.gif",
        "MODERATE_SNOW": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/MODERATE_SNOW.gif",
        "HEAVY_SNOW": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/HEAVY_SNOW.gif",
        "STORM_SNOW": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/HEAVY_SNOW.gif",
        "FOG": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/FOG.gif",
        "WIND": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/WIND.gif",
        "HAZE": "https://raw.githubusercontent.com/58xinian/icon/master/Weather/HAZE.gif"
    };
    return iconMap[skycon] || "https://raw.githubusercontent.com/58xinian/icon/master/Weather/CLOUDY.gif";
}

// 天气描述映射 - 恢复原脚本的描述
function getWeatherDescription(skycon) {
    const descMap = {
        "CLEAR_DAY": "☀️ 晴朗", "CLEAR_NIGHT": "✨ 晴朗",
        "PARTLY_CLOUDY_DAY": "⛅ 多云", "PARTLY_CLOUDY_NIGHT": "☁️ 多云",
        "CLOUDY": "☁️ 阴天", "LIGHT_RAIN": "🌦️ 小雨", 
        "MODERATE_RAIN": "🌧️ 中雨", "HEAVY_RAIN": "⛈️ 大雨",
        "STORM_RAIN": "🌩️ 暴雨", "LIGHT_SNOW": "❄️ 小雪",
        "MODERATE_SNOW": "🌨️ 中雪", "HEAVY_SNOW": "☃️ 大雪",
        "STORM_SNOW": "❄️ 暴雪", "FOG": "🌫️ 雾天",
        "WIND": "💨 大风", "HAZE": "😷 雾霾"
    };
    return descMap[skycon] || "🌤️ 未知";
}

// 风向描述（简化版，8个方向）
function getSimpleWindDirection(degree) {
    const directions = ["北", "东北", "东", "东南", "南", "西南", "西", "西北"];
    const index = Math.round(((degree %= 360) < 0 ? degree + 360 : degree) / 45) % 8;
    return directions[index];
}

// 风向描述（详细版，16个方向）
function getWindDirection(degree) {
    const directions = ["北", "北东北", "东北", "东东北", "东", "东东南", "东南", "南东南", 
                       "南", "南西南", "西南", "西西南", "西", "西西北", "西北", "北西北"];
    const index = Math.round(((degree %= 360) < 0 ? degree + 360 : degree) / 22.5) % 16;
    return directions[index];
}

// 风力等级描述
function getWindLevel(speed) {
    if (speed < 1) return "无风";
    else if (speed < 6) return "软风";
    else if (speed < 12) return "轻风";
    else if (speed < 20) return "微风";
    else if (speed < 29) return "和风";
    else if (speed < 39) return "清风";
    else if (speed < 50) return "强风";
    else if (speed < 62) return "疾风";
    else if (speed < 75) return "大风";
    else if (speed < 89) return "烈风";
    else if (speed < 103) return "狂风";
    else if (speed < 118) return "暴风";
    else return "飓风";
}

// 穿衣建议
function getDressingAdvice(temperature, weatherDesc) {
    const temp = parseInt(temperature);
    if (temp >= 28) return "天气炎热，建议穿短袖、短裤等清凉夏季服装";
    else if (temp >= 24) return "天气较热，建议穿短袖、薄长裤等夏季服装";
    else if (temp >= 18) return "温度舒适，建议穿长袖、薄外套等春秋过渡装";
    else if (temp >= 12) return "天气较凉，建议穿夹克、薄毛衣等春秋服装";
    else if (temp >= 5) return "天气冷，建议穿棉衣、厚外套等冬季服装";
    else return "天气寒冷，建议穿羽绒服、厚棉衣等保暖服装";
}

// 带伞提醒
function getUmbrellaAdvice(weatherDesc) {
    if (weatherDesc.includes("雨") || weatherDesc.includes("雪")) return "明天有降水，记得带伞哦！";
    else if (weatherDesc.includes("阴") || weatherDesc.includes("云")) return "明天可能转阴，建议备伞以防万一";
    else return "明天天气晴朗，无需带伞";
}

// 天行数据天气类型映射
function getTianapiWeatherType(skycon) {
    const typeMap = {
        "CLEAR_DAY": 9, "CLEAR_NIGHT": 9,
        "PARTLY_CLOUDY_DAY": 2, "PARTLY_CLOUDY_NIGHT": 2,
        "CLOUDY": 10, "LIGHT_RAIN": 3, "MODERATE_RAIN": 3,
        "HEAVY_RAIN": 3, "STORM_RAIN": 8, "LIGHT_SNOW": 4,
        "MODERATE_SNOW": 4, "HEAVY_SNOW": 4, "STORM_SNOW": 4,
        "FOG": 7, "WIND": 1, "HAZE": 7
    };
    return typeMap[skycon] || null;
}

// === 新增辅助函数 ===

// 获取星期几
function getWeekday(day) {
    const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    return weekdays[day];
}

// 健康提示
function getHealthAdvice(minTemp, maxTemp) {
    const tempDiff = maxTemp - minTemp;
    if (tempDiff > 10) {
        return "昼夜温差较大，敏感人群需关注温度变化";
    } else if (minTemp < 10) {
        return "早晚气温较低，注意防寒保暖，预防感冒";
    } else {
        return "感冒机率较低，适合外出活动";
    }
}

// 活动建议
function getActivityAdvice(weatherDesc) {
    if (weatherDesc.includes("晴") || weatherDesc.includes("多云")) {
        return "天气适宜户外活动，如散步或运动";
    } else if (weatherDesc.includes("雨")) {
        return "有降雨可能，建议室内活动或携带雨具";
    } else {
        return "可根据个人喜好安排户外或室内活动";
    }
}

// 季节安全提示
function getSeasonSafetyTip() {
    const month = new Date().getMonth() + 1;
    if (month >= 3 && month <= 5) {
        return "春季花粉较多，过敏人群注意防护";
    } else if (month >= 6 && month <= 8) {
        return "夏季高温多雨，注意防暑降温";
    } else if (month >= 9 && month <= 11) {
        return "当前季节干燥，注意用火安全";
    } else {
        return "冬季寒冷干燥，注意防寒保暖";
    }
}

// 总体评价
function getOverallAssessment(weatherDesc, minTemp, maxTemp) {
    if (weatherDesc.includes("雨") || weatherDesc.includes("雪")) {
        return "明日有降水，建议合理安排出行计划，注意携带雨具";
    } else if (minTemp < 5) {
        return "明日天气寒冷，请注意防寒保暖，减少户外暴露时间";
    } else if (maxTemp > 28) {
        return "明日天气炎热，注意防暑降温，多补充水分";
    } else {
        return "明日天气条件良好，可放心安排户外行程，但需注意早晚保暖";
    }
}

// 错误处理
function handleError(title, message) {
    console.error(`❌ 错误: ${title} - ${message}`);
    $notification.post("❌ " + title, message, "");
    $done();
}

// === 启动脚本 ===
main();