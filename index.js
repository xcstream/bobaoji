#!/usr/bin/env node
const process = require('process')


let tts = null
const { KeepLiveWS } = require('bilibili-live-ws')
const spawn = require('child_process').spawn;

let history = []
if(process.platform.indexOf('win') === 0 ){
    var iconv = require('iconv-lite');
    var proc = spawn('powershell');
    var cmd = `
    $sapi = New-Object -COM Sapi.SpVoice
    `
    let encoded = iconv.encode(cmd, 'gbk');
    proc.stdin.write(encoded); // 写入数据

    function say(text) {
        history.unshift(text)
        if( history[0] == history[1]  && history[1]== history[2] ){
            return
        }
        if(history.length>10000){
            history = []
        }
        text = text.replace(/"/g,"");
        var cmd =  `$sapi.Speak("${text}")\n`
        let encoded = iconv.encode(cmd, 'gbk');
        proc.stdin.write(encoded);
    }
    tts = say
}
if(process.platform.indexOf('darwin') === 0 ){
    var proc = spawn('sh');

    function say(text) {
        history.unshift(text)
        if( history[0] == history[1]  && history[1]== history[2] ){
            return
        }
        if(history.length>10000){
            history = []
        }
        text = text.replace(/"/g,"");
        var cmd =  `say "${text}"\n`
        proc.stdin.write(cmd);
    }
    tts = say
}


////say///

const chalk = require('chalk')
var fetch = require('node-fetch')


async function roominfo(id) {
    return new Promise(function (resolve) {
        fetch(`https://api.live.bilibili.com/room/v1/Room/room_init?id=${id}`).then(function (rx) {
            rx.json().then(
                function(r){
                    resolve(r)
                }
            )
        })
    })
}

async function roominfo2(id) {
    return new Promise(function (resolve) {
        fetch(`https://api.live.bilibili.com/room_ex/v1/RoomNews/get?roomid=${id}`).then(function (rx) {
            rx.json().then(
                function(r){
                    resolve(r)
                }
            )
        })
    })
}




function h(){
    console.log(`==========使用方法==========
bobaoji [房间号] [选项...]

选项:
-h          显示帮助
--silent    关闭语音
--nogift    不播报礼物
--nosilver  不播报银瓜子礼物
--nolatiao  不播报辣条

`)
}


var arguments = process.argv.splice(2);

let roomid = arguments[0]

for (let i of arguments){
    if(i == '-h') {
        h();
        process.exit(0)
    }

    if(i == '--silent') {
        tts = function(){}
        console.log('设置: 关闭语音 ')
    }

    if(i == '--nogift') {
        global.nogift = true
        console.log('设置: 不播报礼物 ')
    }

    if(i == '--nosilver') {
        global.nosilver = true
        console.log('设置: 不播报礼物 ')
    }

    if(i == '--nolatiao') {
        global.nolatiao = true
        console.log('设置: 不播报辣条 ')
    }
}

Date.prototype.Format = function(fmt){
    var o = {
        "M+": this.getMonth()+1,
        "d+": this.getDate(),
        "h+": this.getHours(),
        "m+": this.getMinutes(),
        "s+": this.getSeconds(),
        "S+": this.getMilliseconds()
    };
    if(/(y+)/.test(fmt)){
        fmt=fmt.replace(RegExp.$1,(this.getFullYear()+"").substr(4-RegExp.$1.length));
    }
    for(var k in o){
        if (new RegExp("(" + k +")").test(fmt)){
            fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(String(o[k]).length)));
        }
    }
    return fmt;
};


let ws;
let giftbox = []
async function connect(){

    if(!roomid){
        h()
        process.exit(1)
    }
    var info = (await roominfo(roomid)).data
    
    roomid = info.room_id
    
    if(!roomid){
        console.log('直播间不存在')
        process.exit(1)
    }

    const islive = info.live_status == 1 ?'是':'否'

    var info2 = (await roominfo2(roomid)).data

    console.log(
`=========================================================================
主播:${info2.uname} 房间号:${info.room_id} 短号:${info.short_id} 直播中:${islive}
通知:${info2.content}
=========================================================================`)

    ws = new KeepLiveWS(Number(roomid))

    ws.on('open', () => {
        //console.log('连接成功')
    })
    ws.on('live', () => {
        //console.log('开始播报')
    })
    ws.on('close', () => {
        console.log('连接断开')
    })

    ws.on('DANMU_MSG', msg=>{
        if(msg.info){
            var content = msg.info[1]
            var name = msg.info[2][1]
            var text = chalk.yellow(name) + '说' + chalk.green(content)
            var textr= name + '说' + content
            console.log(chalk.gray(timestamp())+text)
            tts(textr)

        }
    })

    ws.on('SEND_GIFT', msg=>{
        if(msg.data){
            var gift = msg.data.giftName
            var num = msg.data.num
            var name = msg.data.uname

            var type = '(银瓜子)'
            if (msg.data.coin_type =='gold' ){
                type = '(金瓜子)'
            }

            if(name=='辣条' && num < 10){
                return
            }
            var text = chalk.yellow(name) + '赠送了'+chalk.green(num)+'个'+ chalk.green(gift) + type
            var textr = name + '赠送了'+num +'个'+ gift
            console.log(chalk.gray(timestamp())+text)
            if(global.nogift) return 
            if(global.nosilver && type == '(银瓜子)') return
            if(global.nolatiao && gift == '辣条') return
            tts(textr)
            
        }
    })
    return true
}

function timestamp(){
    return new Date().Format('[yyyy-MM-dd hh:mm:ss]')
}




connect()