# 实时语音转写与同声传译API文档

# 实时语音转写API文档

## 接口说明

实时语音转写（Real-time ASR）基于深度全序列卷积神经网络框架，通过 WebSocket 协议，建立应用与语言转写核心引擎的长连接，开发者可实现将连续的音频流内容，实时识别返回对应的文字流内容�?
支持的音频格式： 采样率为16K，采样深度为16bit�?*pcm_s16le**单声道音�?

## 注意事项

* 如果开启实时声纹识别，因为声纹识别根据计算量不同可能比实时asr识别有滞后，所以客户端不要主动关闭websocket连接
* 服务端做完毕所有实时asr识别和实时声纹识别后，会主动断掉客户端连接�?


## 接口Demo

参照git代码中的sdk实例代码�?

## 接口参数规范

集成实时语音转写API时，需按照以下要求�?

| 内容     | 说明                                                         |
| :------- | ------------------------------------------------------------ |
| 请求协议 | wss                                                          |
| 请求地址 | wss://your-api-domain.com/asr-realtime/v2/ws?{请求参数} ** |
| 接口鉴权 | 签名机制，详�?[signa生成](#signa生成)                       |
| 响应格式 | 统一采用JSON格式                                             |
| 开发语言 | 任意，只要可以向语音云服务发起WebSocket请求的均�?           |
| 音频属�?| 采样�?6k、位�?6bit、单声道(pcm_s16le)                      |
| 音频格式 | pcm                                                          |
| 数据发�?| 建议音频流每200ms发�?400字节                                |


## 接口调用流程

实时语音转写接口调用包括两个阶段：握手阶段和实时通信阶段�?

### 握手阶段

接口地址

```bash
wss://your-api-domain.com/asr-realtime/v2/ws?{请求参数}
```

   

参数格式

```text
key1=value1&key2=value2…（key和value都需要进行urlencode�?
```

参数说明

| 参数              | 类型   | 必须 | 说明                                                         | 示例                                                         |
| :---------------- | :----- | :--- | :----------------------------------------------------------- | :----------------------------------------------------------- |
| appid             | string | �?  | 开放平台应用ID                                               | your_app_id                                                  |
| ts                | string | �?  | 当前时间戳，�?970�?�?�?�?�?秒开始到现在的秒�?         | 1512041814                                                   |
| signa             | string | �?  | 加密数字签名（基于HMACSHA1算法�?                            | IrrzsJeOFk1NGfJHW6SkHUoN9CU=                                 |
| voiceprint        | string | �?  | 是否启用实时声纹识别（对返回的每段话做说话人实时识别）； �?表示启用，为0表示不启用�?默认开启�?| 1                                                            |
| voiceprint_org_id | string | �?  | 声纹识别的组织id，默认为申请app key时候给的application id�?org id + tag id + speaker name组成一个最终确认的说话人身份�?*注册声纹时候传入的相应参数必须和这里的相同**�?| 默认为申请app key时候给的application id                      |
| voiceprint_tag_id | string |      | 声纹识别的tag id�?默认为申请app key时候给的application id�?org id + tag id + speaker name组成一个最终确认的说话人身份�?**注册声纹时候传入的相应参数必须和这里的相同**�?| 默认为申请app key时候给的application id                      |
| scene             | string | �?  | 垂直领域个性化参数: <br/>法院: court <br/>教育: edu <br/>金融: finance <br/>医疗: medical <br/>科技: tech <br/>运营�? isp <br/>政府: gov <br/>电商: ecom <br/>军事: mil <br/>企业: com <br/>生活: life <br/>汽车: car | 设置示例：scene="edu" 参数scene为非必须设置，不设置参数默认为通用 |
| asr_type          | string | �?  | 识别结果输出类型，sentence，输出逐句结果；word，输出逐字和逐句结果，默认为word�?| "word"                                                       |
| noise_threshold   | float  | �?  | 噪音参数阈值，默认�?.5，取值范围：[0.3,1]，对于一些音频片段，取值越大，判定为噪音情况越大。取值越小，判定为人声情况越大�?br/>**慎用：可能影响识别效�?* | 0.5                                                          |

�?）、实时变更同声传译参�? 可在实时识别的时候传输下面的json字符串，以实时变更输出结果，如是否启动同声传译，启动同声传译时候的目标语言；是否对识别结果打标点符号；识别场景切换等�?

 ```json
                         //传输该控制命令的时候，将下面的json数据编码成字符串传输（不是二进制数据�?
                         {
                             "translate": {
                                 "src_lang": "zh",
                                 "tgt_lang": "en",
                                 "enabled": 1
                             },
                             "punc":{
                                 "enabled": 1
                             },
                             "scene": "court"
                         }
 ```

实时变更参数说明�?

* 语言参数
  * src_lang:  源语言，如“zh', "de"等；如输入空格字符串表示自动识别源语言
  * tgt_lang: 目标语言，如”de", "ja" �?
  * 常见翻译语种：控制把源语言转换成什么类型的语言�?br/>中文：cn<br/>英文：en<br/>日语：ja<br/>韩语：ko<br/>俄语：ru<br/>法语：fr<br/>西班牙语：es<br/>意大利：vi<br/>
  * 可选国家编码列表有：af, am, ar, as, az, ba, be, bg, bn, bo, br, bs, ca, cs, cy, da, de, el, en, es, et, eu, fa, fi, fo, fr, gl, gu, ha, haw, he, hi, hr, ht, hu, hy, id, is, it, ja, jw, ka, kk, km, kn, ko, la, lb, ln, lo, lt, lv, mg, mi, mk, ml, mn, mr, ms, mt, my, ne, nl, nn, no, oc, pa, pl, ps, pt, ro, ru, sa, sd, si, sk, sl, sn, so, sq, sr, su, sv, sw, ta, te, tg, th, tk, tl, tr, tt, uk, ur, uz, vi, yi, yo, zh
* enabled�?是否打开同声传译�?表示打开�?表示关闭同声传译

### signa生成 

* 参考对应的sdk代码�?

### 返回�?

结果格式为json，字段说明如下：

| 参数      | 类型   | 说明                                                         |
| :-------- | :----- | :----------------------------------------------------------- |
| code      | string | 结果�?具体�?<a href="#错误�?>错误�?/a> �?出现错误的时候返�? |
| msg       | string | 结果数据（出现错误的时候返回）                               |
| seg_id    | string | �?开始的语句id，返回的每条语句逐步递增seg_id; 注意只有一句话完整稳定识别后才会递增seg_id, is_final为True�?表示一句话完全稳定识别完毕�?|
| type      | string | asr: 表示是实时语音识别返回的文本�? voiceprint：表示是实时声纹识别返回的说话人 |
| is_final  | bool   | True�?表示这句话返回的结果已经稳定，不再修改；False：表示这段话会根据上下文继续矫正，可能继续修�?|
| task_id   | uuid   | 每次实时识别，赋予一个新的uuid，是每次识别会话的唯一id�?    |
| asr       | string | 当type是asr时，返回的实时语音识别的文本结果�?               |
| speaker   | string | 当type是voiceprint的时候，返回的实时声纹识别的说话人身份�?  |
| translate | string | 当开启同声传译后，返回的目标翻译语言�?*文档待完�?*�?      |
| rt        | list   | 返回的逐字时间戳和对应的文字或词组�?*文档待完�?*)          |

其中task_id字段主要用于DEBUG追查问题，如果出现问题，可以提供task_id帮助确认问题�?

> 成功

```json
{'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 28, 'asr': '模型的决策过程比如提升对复杂语境�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
```

> 失败

```json
	{
		"code":"10106",
		"msg":"invalid parameter",
        'task_id': '1583d7e1-3dea-4e2b-96b2-f562f38dc652'
	}
```

### 实时通信阶段

握手成功后，进入实时通信阶段，此时客户端的主动操作有两种：上传数据和上传结束标识，被动操作有两种：接收转写结果和错误

### 上传数据

在实时转写过程中，客户端不断构造binary message发送到服务端，内容是音频的二进制数据。此操作的频率影响到文字结果展现的实时性�?

注意�?

1.建议音频流每200ms发�?400字节，发送过快可能导致引擎出错； 2.音频发送间隔超时时间为5�?闲置时间过长)，超时服务端报错并主动断开连接�?

### 上传结束标志

音频数据上传完成后，客户端需发送一个特殊的binary message到服务端作为结束标识，内容是�?

```json
 	{""} 或�?{"end": true}
```

###  接收转写结果

交互过程中，服务端不断返�?text message （转写结果） 到客户端。当所有结果发送完毕后，服务端断开连接，交互结束�?

* 结果示例�?

```json
{'rt': [], 'is_final': False, 'seg_id': 0, 'asr': '哈喽', 'translate': ''}
```

* 转写结果字段说明如下�?

| 字段      | 含义           | 描述                          |
| :-------- | :------------- | :---------------------------- |
| asr       | 语音识别结果   | **这是实时识别的结�?*        |
| translate | 同声传译的结�?| **这是实时同声传译的结�?*    |
| is_final  | 结果类型标识   | True-最终结果；False-中间结果 |
| seg_id    | 转写结果序号   | �?开�?                      |

### 接收错误信息

交互过程中，在服务端出现异常而中断服务时（如会话超时），会将异常信息�?text message 形式返回给客户端并关闭连接�?

###  实时变更指令，实现语言的切换，或者场景的切换

变更源语言和目标语言, 和变更场景，统一使用下述指令，实时发送到现有的已有的websocket链接上（和语音数据的二进制数据不同）

{"config": { "lang": {"source_lang": "zh", "target_lang": "en"}}, "scene": "law"}

* lang字典表示源语言和目标语言切换（有lang字典的时候，source_lang和target_lang必须同时存在），scene表示场景切换�?
* lang和scene两者或的存在，也就是：
  * 有lang，无scene
  * 无lang，有scene
  * 有lang，有scene

## 白名�?

在调用该业务接口�?

- 若关闭IP白名单，接口认为IP不限，不会校验IP�?
- 若打开IP白名单，则服务端会检查调用方IP是否在开放平台配置的IP白名单中，对于没有配置到白名单中的IP发来的请求，服务端会拒绝服务�?

IP白名单规�?

- 不同Appid的不同服务都需要分别设置IP白名单；
- IP白名单需设置为外网IP，请勿设置局域网IP�?
- 如果服务器返回结果如下所�?illegal client_ip)，则表示由于未配置IP白名单或配置有误，服务端拒绝服务�?

```json
{
	"action": "error",
	"code": "10105",
	"data": "",
	"desc": "illegal access|illegal client_ip: xx.xx.xx.xx",
	"sid": "rta..."
}
```

## 错误�?

| 错误�?| 描述                                                         | 说明                     | 处理方式                                                    |
| :----- | :----------------------------------------------------------- | :----------------------- | :---------------------------------------------------------- |
| 0      | success                                                      | 成功                     |                                                             |
| -1     | in progress                                                  | 识别�?                  | 请继续重�?                                                 |
| -2     | audio encode error                                           | 音频编码错误             | 请编码成正确的格式，再提交请�?                             |
| 10105  | illegal access                                               | 没有权限                 | 检查apiKey，ip，ts等授权参数是否正�?                       |
| 10106  | invalid parameter                                            | 无效参数                 | 上传必要的参数， 检查参数格式以及编�?                      |
| 10107  | illegal parameter                                            | 非法参数�?              | 检查参数值是否超过范围或不符合要�?                         |
| 10109  | audio url is not valid http(s) url                           | audio_url不是http[s]链接 | 长语音识别的时候，audio_url必须是http[s]链接                |
| 10110  | no license                                                   | 无授权许�?              | 检查参数值是否超过范围或不符合要�?                         |
| 10700  | engine error                                                 | 引擎错误                 | 提供接口返回值，向服务提供商反馈                            |
| 10701  | Audio encode error, only support pcm, aac, mpeg2, opus and flac | 音频编码错误             | 支持pcm, aac, mpeg2, opus �?flac这几种编码，请选择其中一�?|
| 10702  | Audio sample error, only support 8000�?6000�?4100 and 48000 Hz | 音频采样率错�?          | 支持 8000�?6000�?4100 �?48000 Hz，请选择其中一�?        |
| 10202  | websocket connect error                                      | websocket连接错误        | 检查网络是否正�?                                           |
| 10204  | websocket write error                                        | 服务端websocket写错�?   | 检查网络是否正常，向服务提供商反馈                          |
| 10205  | websocket read error                                         | 服务端websocket读错�?   | 检查网络是否正常，向服务提供商反馈                          |
| 16003  | basic component error                                        | 基础组件异常             | 重试或向服务提供商反�?                                     |
| 10800  | over max connect limit                                       | 超过授权的连接数         | 确认连接数是否超过授权的连接�?                             |

## 常见问题

#### 实时语音转写支持什么平台？

> 答：实时转写只支持webapi接口，开放平台“实时语音转写”需要WebSocket接入，针对是有编程基础的开发者用户。如果您是个人用户，不想通过编程方式直接实现语音转写功能，可以去官网，了解语音转写功能的更多详情�?

#### 实时语音转写支持什么语言�?

> 答：中文普通话、中英混合识别、英文；中英文之外的语音识别请联系商务�?

#### 支持的音频是什么格式？

> 答：采样率为16K，采样深度为16bit的pcm_s16le音频

#### 实时语音转写支持的音频时长有什么限制？

> 答：实时语音转写可以实时识别持续的音频流，结果是实时返回，音频流长度理论上不做限制，典型的应用场景是大会或者直播的实时字幕�?

#### 实时语音转写的分片时�?00ms是什么意思？

> 答：可以理解为上传的间隔�?00ms，建议音频流�?00ms向服务器发�?400字节，发过快可能导致引擎出错，音频发送间隔超时时间为15s，超时服务端报错并主动断开连接�?

#### 实时语音转写支不支持离线�?

> 答：这个问题有点矛盾；我们有离线识别的api，请使用离线asr api完成请求服务�?

#### 实时语音转写如果一次连接使用时长超出了剩余时长怎么办？

> 答：首先为了使业务使用不受影响，如果在连接期间使用时长超出，转写功能并不会立刻停止。本次连接断开后时长可能会出现为负数的情况，请在使用过程中关注时长剩余情况并及时购买时长�?

## 调用返回实例

### 实时声纹识别和实时语音识�?--逐句返回实例（asr_type为sentence�?

```json
(asr_prd) root@JumpAI:~/gitlab/asr-daemon/docs/sdk/python# ./auto_test_asr_v2.py --mode json --audio_file ../dataset/asr/1006_20241223_081645_full_audio.wav  --asr_type sentence
2024-12-29 15:02:28.030 | INFO     | __main__:connect_to_server:101 - app_id: your_app_id, app_secret: your_app_secret
2024-12-29 15:02:29.396 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 0, 'asr': '我是小黄同学�?, 'start': 0.254, 'end': 1.5739375, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02'}
2024-12-29 15:02:30.341 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 0, 'asr': '我是小黄同学�?, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02', 'timestamp': 1735455749.365876, 'speaker': '未知'}
2024-12-29 15:02:30.342 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 1, 'asr': '请问您有什么有趣的问题？�?, 'start': 2.078, 'end': 3.8139375, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02'}
2024-12-29 15:02:31.195 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 1, 'asr': '请问您有什么有趣的问题？�?, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02', 'timestamp': 1735455750.339033, 'speaker': '未知'}
2024-12-29 15:02:33.730 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 2, 'asr': '小关同学，你现在是一个面试人员�?, 'start': 6.462, 'end': 10.4699375, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02'}
2024-12-29 15:02:34.656 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 2, 'asr': '小关同学，你现在是一个面试人员�?, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02', 'timestamp': 1735455753.7282188, 'speaker': '张明'}
2024-12-29 15:02:36.277 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 3, 'asr': '主要面试这个计算机呃人工智能领域�?, 'start': 10.718, 'end': 15.7719375, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02'}
2024-12-29 15:02:36.709 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 4, 'asr': '我�?, 'start': 15.838, 'end': 16.5819375, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02'}
2024-12-29 15:02:37.332 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 3, 'asr': '主要面试这个计算机呃人工智能领域�?, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02', 'timestamp': 1735455756.276181, 'speaker': '张明'}
2024-12-29 15:02:38.048 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 5, 'asr': '充当一个面试者，你现在开始吧�?, 'start': 16.894, 'end': 19.2379375, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02'}
2024-12-29 15:02:38.068 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 4, 'asr': '我�?, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02', 'timestamp': 1735455756.708718, 'speaker': '未知'}
2024-12-29 15:02:38.971 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 5, 'asr': '充当一个面试者，你现在开始吧�?, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02', 'timestamp': 1735455758.0478108, 'speaker': '张明'}
2024-12-29 15:02:41.503 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 6, 'asr': '好呀，那我先问你一个问题，在人工智能领域里，你最擅长哪方面呢？�?, 'start': 20.83, 'end': 25.9479375, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02'}
2024-12-29 15:02:42.139 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 7, 'asr': '是机器学习。�?, 'start': 26.366, 'end': 27.3659375, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02'}
2024-12-29 15:02:42.582 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 6, 'asr': '好呀，那我先问你一个问题，在人工智能领域里，你最擅长哪方面呢？�?, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02', 'timestamp': 1735455761.501575, 'speaker': '未知'}
2024-12-29 15:02:43.395 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 7, 'asr': '是机器学习。�?, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02', 'timestamp': 1735455762.139151, 'speaker': '未知'}
2024-12-29 15:02:45.416 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 8, 'asr': '我非擅长这个呃人机交互的语音领域�?, 'start': 28.062, 'end': 33.7239375, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02'}
2024-12-29 15:02:46.557 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 8, 'asr': '我非擅长这个呃人机交互的语音领域�?, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02', 'timestamp': 1735455765.4150665, 'speaker': '张明'}
2024-12-29 15:02:46.557 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 9, 'asr': '很棒呀。�?, 'start': 35.422, 'end': 36.0699375, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02'}
2024-12-29 15:02:47.333 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 9, 'asr': '很棒呀。�?, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02', 'timestamp': 1735455766.5549018, 'speaker': '未知'}
2024-12-29 15:02:48.929 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 10, 'asr': '那你觉得在语音领域里，处理语音识别的最大挑战是什么？', 'start': 36.542, 'end': 40.5819375, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02'}
2024-12-29 15:02:49.869 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 10, 'asr': '那你觉得在语音领域里，处理语音识别的最大挑战是什么？', 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02', 'timestamp': 1735455768.9275815, 'speaker': '未知'}
2024-12-29 15:02:51.813 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 11, 'asr': '语音识别的这个精准度，有也就是说它的错误率的降低�?, 'start': 41.726, 'end': 46.6519375, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02'}
2024-12-29 15:02:52.781 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 11, 'asr': '语音识别的这个精准度，有也就是说它的错误率的降低�?, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02', 'timestamp': 1735455771.8114164, 'speaker': '张明'}
2024-12-29 15:02:54.085 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 12, 'asr': '确实如此，提升准确率是关键�?, 'start': 48.222, 'end': 50.8539375, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02'}
2024-12-29 15:02:54.948 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 12, 'asr': '确实如此，提升准确率是关键�?, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02', 'timestamp': 1735455774.0835714, 'speaker': '未知'}
2024-12-29 15:02:55.658 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 13, 'asr': '那你怎么看待不同口音对语音识别的影响呢？', 'start': 51.262, 'end': 54.1179375, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02'}
2024-12-29 15:02:56.533 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 13, 'asr': '那你怎么看待不同口音对语音识别的影响呢？', 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02', 'timestamp': 1735455775.6574075, 'speaker': '未知'}
2024-12-29 15:03:00.735 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 14, 'asr': '我认为不同口音呢对语音识别的影响很大。我们需要首先做好这个泛话能 力，同时针对�?, 'start': 55.294, 'end': 64.0279375, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02'}
2024-12-29 15:03:01.972 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 14, 'asr': '我认为不同口音呢对语音识别的影响很大。我们需要首先做好这个泛话能力，同时针对�?, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02', 'timestamp': 1735455780.7337708, 'speaker': '张明'}
2024-12-29 15:03:02.957 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 15, 'asr': '每一种语音或者每一种方言做特定的训练调优�?, 'start': 64.094, 'end': 68.5819375, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02'}
2024-12-29 15:03:03.998 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 15, 'asr': '每一种语音或者每一种方言做特定的训练调优�?, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02', 'timestamp': 1735455782.95544, 'speaker': '张明'}
2024-12-29 15:03:04.198 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 16, 'asr': '说的太好了。�?, 'start': 70.11, 'end': 71.0459375, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02'}
2024-12-29 15:03:04.930 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 16, 'asr': '说的太好了。�?, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02', 'timestamp': 1735455784.1966484, 'speaker': '未知'}
2024-12-29 15:03:06.393 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 17, 'asr': '准确捕捉口音特点并专项优化确实很重要�?, 'start': 71.582, 'end': 75.1419375, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02'}
2024-12-29 15:03:07.330 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 17, 'asr': '准确捕捉口音特点并专项优化确实很重要�?, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02', 'timestamp': 1735455786.391795, 'speaker': '未知'}
2024-12-29 15:03:08.253 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 18, 'asr': '那你有没有什么创新的想法来改善这一点呢？�?, 'start': 75.55, 'end': 78.7259375, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02'}
2024-12-29 15:03:09.131 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 18, 'asr': '那你有没有什么创新的想法来改善这一点呢？�?, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02', 'timestamp': 1735455788.251661, 'speaker': '未知'}
2024-12-29 15:03:12.510 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 19, 'asr': '我认为呢在大规模数据集制下，首先做好方法能力，然后针对每一种语�?呢做好�?, 'start': 80.382, 'end': 87.3879375, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02'}
2024-12-29 15:03:13.619 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 19, 'asr': '我认为呢在大规模数据集制下，首先做好方法能力，然后针对每一种语音呢做好�?, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02', 'timestamp': 1735455792.508744, 'speaker': '张明'}
2024-12-29 15:03:13.619 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 20, 'asr': '呃，声音的编编码器解码器�?, 'start': 87.678, 'end': 89.8939375, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02'}
2024-12-29 15:03:14.424 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 20, 'asr': '呃，声音的编编码器解码器�?, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02', 'timestamp': 1735455793.616748, 'speaker': '张明'}
2024-12-29 15:03:16.595 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 21, 'asr': '那编码器解码器呢是一种传统的能力。我觉得最主要的就是说现在需要�?, 'start': 90.238, 'end': 95.5479375, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02'}
2024-12-29 15:03:17.667 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 21, 'asr': '那编码器解码器呢是一种传统的能力。我觉得最主要的就是说现在需要�?, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02', 'timestamp': 1735455796.5932224, 'speaker': '张明'}
2024-12-29 15:03:18.585 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 22, 'asr': '通过人工智能做好这个每种发译的泛化能力�?, 'start': 95.742, 'end': 99.3979375, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02'}
2024-12-29 15:03:19.514 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 22, 'asr': '通过人工智能做好这个每种发译的泛化能力�?, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02', 'timestamp': 1735455798.5831282, 'speaker': '张明'}
2024-12-29 15:03:19.729 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 23, 'asr': '很有见地。�?, 'start': 100.926, 'end': 101.7659375, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02'}
2024-12-29 15:03:20.494 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 23, 'asr': '很有见地。�?, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02', 'timestamp': 1735455799.7276363, 'speaker': '未知'}
2024-12-29 15:03:21.227 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 24, 'asr': '提升模型的泛化能力确实是关键�?, 'start': 102.27, 'end': 104.8379375, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02'}
2024-12-29 15:03:22.101 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 24, 'asr': '提升模型的泛化能力确实是关键�?, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02', 'timestamp': 1735455801.2256832, 'speaker': '未知'}
2024-12-29 15:03:23.468 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 25, 'asr': '那你觉得强化学习能在语音识别中起到什么作用呢�?, 'start': 105.214, 'end': 108.9659375, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02'}
2024-12-29 15:03:24.396 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 25, 'asr': '那你觉得强化学习能在语音识别中起到什么作用呢�?, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02', 'timestamp': 1735455803.466399, 'speaker': '未知'}
2024-12-29 15:03:25.973 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 26, 'asr': '学习最大的作用呢就是这个�?, 'start': 110.782, 'end': 114.2139375, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02'}
2024-12-29 15:03:26.908 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 26, 'asr': '学习最大的作用呢就是这个�?, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02', 'timestamp': 1735455805.9720411, 'speaker': '张明'}
2024-12-29 15:03:27.667 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 27, 'asr': '哎，你给我说一下吧，我不知道哎嗯�?, 'start': 114.654, 'end': 117.3819375, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02'}
2024-12-29 15:03:28.583 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 27, 'asr': '哎，你给我说一下吧，我不知道哎嗯�?, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02', 'timestamp': 1735455807.6653502, 'speaker': '张明'}
2024-12-29 15:03:28.949 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 28, 'asr': '哈哈没关系。�?, 'start': 118.942, 'end': 120.2619375, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02'}
2024-12-29 15:03:29.826 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 28, 'asr': '哈哈没关系。�?, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02', 'timestamp': 1735455808.948314, 'speaker': '未知'}
2024-12-29 15:03:32.259 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 29, 'asr': '强化学习可以在语音识别中优化模型的决策过程，比如提升对复杂语境的 理解�?, 'start': 120.766, 'end': 126.6199375, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02'}
2024-12-29 15:03:33.333 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 29, 'asr': '强化学习可以在语音识别中优化模型的决策过程，比如提升对复杂语境的理解�?, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02', 'timestamp': 1735455812.25741, 'speaker': '未知'}
2024-12-29 15:03:33.857 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 30, 'asr': '你平时会关注哪些技术博客或论文呢？', 'start': 127.006, 'end': 129.8939375, 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02'}
2024-12-29 15:03:34.719 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 30, 'asr': '你平时会关注哪些技术博客或论文呢？', 'task_id': '21bb10b7-6571-4344-bb6b-fe4e763aca02', 'timestamp': 1735455813.8553944, 'speaker': '未知'}
receive_recognition_result error: ConnectionClosedOK(Close(code=1000, reason=''), Close(code=1000, reason=''), True)
```



### 实时声纹识别和实时语音识�?--逐字返回实例（asr_type为word�?

```json
(asr_prd) root@JumpAI:~/gitlab/asr-daemon/docs/sdk/python# ./auto_test_asr_v2.py --mode json --audio_file ../dataset/asr/1006_20241223_081645_full_audio.wav
2024-12-29 15:03:56.375 | INFO     | __main__:connect_to_server:101 - app_id: your_app_id, app_secret: your_app_secret
2024-12-29 15:03:56.651 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 0, 'asr': '�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:03:56.716 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 0, 'asr': '我是', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:03:56.915 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 0, 'asr': '我是�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:03:57.017 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 0, 'asr': '我是小黄�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:03:57.217 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 0, 'asr': '我是小黄同学', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:03:57.725 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 0, 'asr': '我是小黄同学请问�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:03:57.823 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 0, 'asr': '我是小黄同学请问您有什�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:03:58.026 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 0, 'asr': '我是小黄同学请问您有什么有�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:03:58.229 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 0, 'asr': '我是小黄同学请问您有什么有趣的问题', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:03:59.062 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 0, 'asr': '我是小黄同学，请问您有什么有趣的问题？�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:03:59.939 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 1, 'asr': '小环同学', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:00.144 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 0, 'asr': '我是小黄同学，请问您有什么有趣的问题？�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'timestamp': 1735455839.0605414, 'speaker': '未知'}
2024-12-29 15:04:00.243 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 1, 'asr': '小环同学你现�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:00.647 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 1, 'asr': '小环同学你现在是一�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:00.792 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 1, 'asr': '', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'timestamp': 1735455839.445178, 'speaker': '未知'}
2024-12-29 15:04:01.250 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 1, 'asr': '小环同学你现在是一个面�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:01.454 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 1, 'asr': '小环同学你现在是一个面试人�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:02.217 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 1, 'asr': '小环同学，你现在是一个面试人员，主要�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:02.261 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 2, 'asr': '面试', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:02.566 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 2, 'asr': '面试这个', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:03.066 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 2, 'asr': '面试这个计算�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:03.213 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 1, 'asr': '小环同学，你现在是一个面试人员，主要�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'timestamp': 1735455842.215249, 'speaker': '张明'}
2024-12-29 15:04:03.860 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 2, 'asr': '是这个计算机呃�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:03.887 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 3, 'asr': '�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:03.973 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 3, 'asr': '人工智能', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:04.175 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 3, 'asr': '人工智能领域', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:04.779 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 3, 'asr': '人工智能领域�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:04.801 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 2, 'asr': '是这个计算机呃�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'timestamp': 1735455843.858328, 'speaker': '张明'}
2024-12-29 15:04:05.083 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 3, 'asr': '人工智能领域我送他一', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:05.283 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 3, 'asr': '人工智能领域我送他一�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:05.484 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 3, 'asr': '人工智能领域我送他一个密室诊', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:05.789 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 3, 'asr': '人工智能领域我送他一个密室诊你现�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:05.888 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 3, 'asr': '人工智能领域我送他一个密室诊你现在开�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:06.090 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 3, 'asr': '人工智能领域我送他一个密室诊你现在开始吧', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:06.428 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 3, 'asr': '人工智能领域，我充当一个面试者，你现在开始吧�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:07.097 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 4, 'asr': '好呀', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:07.199 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 4, 'asr': '好呀�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:07.399 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 4, 'asr': '好呀那我�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:07.502 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 4, 'asr': '好呀那我先问�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:07.562 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 3, 'asr': '人工智能领域，我充当一个面试者，你现在开始吧�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'timestamp': 1735455846.426013, 'speaker': '张明'}
2024-12-29 15:04:07.706 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 4, 'asr': '好呀那我先问你一个问�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:08.207 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 4, 'asr': '好呀那我先问你一个问题在人工', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:08.219 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 4, 'asr': '', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'timestamp': 1735455846.9078069, 'speaker': '未知'}
2024-12-29 15:04:08.308 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 4, 'asr': '好呀那我先问你一个问题在人工智能', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:08.510 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 4, 'asr': '好呀那我先问你一个问题在人工智能领域', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:08.713 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 4, 'asr': '好呀那我先问你一个问题在人工智能领域�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:09.016 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 4, 'asr': '好呀那我先问你一个问题在人工智能领域里你最擅长', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:09.320 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 4, 'asr': '好呀那我先问你一个问题在人工智能领域里你最擅长哪方�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:09.744 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 4, 'asr': '好呀，那我先问你一个问题，在人工智能领域里，你最擅长哪方面？😊', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:09.921 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 5, 'asr': '是机', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:10.123 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 5, 'asr': '是机器学�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:10.903 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 5, 'asr': '的是机器学习�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:10.932 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 6, 'asr': '我非�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:11.131 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 6, 'asr': '我非常谈�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:11.231 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 6, 'asr': '我非常谈这个', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:11.832 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 6, 'asr': '我最擅长这个�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:11.939 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 7, 'asr': '�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:12.009 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 4, 'asr': '好呀，那我先问你一个问题，在人工智能领域里，你最擅长哪方面？😊', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'timestamp': 1735455849.743135, 'speaker': '未知'}
2024-12-29 15:04:12.339 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 7, 'asr': '呃呃', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:12.743 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 7, 'asr': '呃呃人机', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:12.853 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 5, 'asr': '的是机器学习�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'timestamp': 1735455850.9020293, 'speaker': '未知'}
2024-12-29 15:04:13.047 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 7, 'asr': '呃呃人机交互�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:13.147 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 7, 'asr': '呃呃人机交互的语�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:13.349 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 7, 'asr': '呃呃人机交互的语音领�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:13.651 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 6, 'asr': '我最擅长这个�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'timestamp': 1735455851.8317218, 'speaker': '张明'}
2024-12-29 15:04:14.170 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 7, 'asr': '呃，人人机交互的语音领域�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:14.457 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 8, 'asr': '很棒呀', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:14.960 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 8, 'asr': '很棒呀那你', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:15.161 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 8, 'asr': '很棒呀那你觉得', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:15.163 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 7, 'asr': '呃，人人机交互的语音领域�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'timestamp': 1735455854.168629, 'speaker': '张明'}
2024-12-29 15:04:15.261 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 8, 'asr': '很棒呀那你觉得�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:15.466 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 8, 'asr': '很棒呀那你觉得在语音领', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:15.564 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 8, 'asr': '很棒呀那你觉得在语音领域里', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:15.967 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 8, 'asr': '很棒呀那你觉得在语音领域里处理', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:16.069 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 8, 'asr': '很棒呀那你觉得在语音领域里处理语音', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:16.271 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 8, 'asr': '很棒呀那你觉得在语音领域里处理语音识别�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:16.373 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 8, 'asr': '很棒呀那你觉得在语音领域里处理语音识别的最�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:16.796 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 8, 'asr': '很棒呀，那你觉得在语音领域里，处理语音识别的最大条。�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:16.821 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 9, 'asr': '是什�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:17.338 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 9, 'asr': '挑战是什么？', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:17.680 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 10, 'asr': '语音', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:17.892 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 10, 'asr': '语音识别�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:17.894 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 8, 'asr': '很棒呀，那你觉得在语音领域里，处理语音识别的最大条。�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'timestamp': 1735455856.794934, 'speaker': '未知'}
2024-12-29 15:04:17.984 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 10, 'asr': '语音识别的这�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:18.184 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 10, 'asr': '语音识别的这个精�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:18.386 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 10, 'asr': '语音识别的这个精准度', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:18.656 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 9, 'asr': '挑战是什么？', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'timestamp': 1735455857.3373854, 'speaker': '未知'}
2024-12-29 15:04:18.695 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 10, 'asr': '语音识别的这个精准度�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:18.793 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 10, 'asr': '语音识别的这个精准度有也就是', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:18.992 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 10, 'asr': '语音识别的这个精准度有也就是�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:19.195 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 10, 'asr': '语音识别的这个精准度有也就是说他�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:19.294 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 10, 'asr': '语音识别的这个精准度有也就是说他的错�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:19.504 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 10, 'asr': '语音识别的这个精准度有也就是说他的错误率�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:20.025 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 10, 'asr': '语音识别的这个精准度，有也就是说它的错误力的�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:20.545 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 11, 'asr': '很低�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:20.912 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 12, 'asr': '确实', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:21.004 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 10, 'asr': '语音识别的这个精准度，有也就是说它的错误力的�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'timestamp': 1735455860.0236557, 'speaker': '张明'}
2024-12-29 15:04:21.110 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 12, 'asr': '确实如此', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:21.411 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 12, 'asr': '确实如此提升', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:21.613 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 12, 'asr': '确实如此提升准确�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:21.715 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 11, 'asr': '很低�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'timestamp': 1735455860.5450077, 'speaker': '未知'}
2024-12-29 15:04:21.916 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 12, 'asr': '确实如此提升准确率是关键', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:22.419 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 12, 'asr': '确实如此提升准确率是关键�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:22.522 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 12, 'asr': '确实如此提升准确率是关键那你怎么�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:22.722 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 12, 'asr': '确实如此提升准确率是关键那你怎么看待不同', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:22.824 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 12, 'asr': '确实如此提升准确率是关键那你怎么看待不同�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:23.248 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 12, 'asr': '确实如此，提升准确率是关键。那你怎么看待不同口？', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:23.274 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 13, 'asr': '对语�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:23.327 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 13, 'asr': '对语音识别的', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:23.530 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 13, 'asr': '对语音识别的影响', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:23.630 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 13, 'asr': '对语音识别的影响�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:24.214 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 13, 'asr': '对语音识别的影响呢？', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:24.340 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 12, 'asr': '确实如此，提升准确率是关键。那你怎么看待不同口？', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'timestamp': 1735455863.2466328, 'speaker': '未知'}
2024-12-29 15:04:24.439 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 14, 'asr': '�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:24.639 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 14, 'asr': '我认为不', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:24.840 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 14, 'asr': '我认为不�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:24.941 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 14, 'asr': '我认为不同口�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:25.143 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 14, 'asr': '我认为不同口音呢', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:25.144 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 13, 'asr': '对语音识别的影响呢？', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'timestamp': 1735455864.2138379, 'speaker': '未知'}
2024-12-29 15:04:25.646 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 14, 'asr': '我认为不同口音呢�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:25.748 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 14, 'asr': '我认为不同口音呢对语音识�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:25.949 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 14, 'asr': '我认为不同口音呢对语音识别的影响', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:26.051 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 14, 'asr': '我认为不同口音呢对语音识别的影响�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:26.254 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 14, 'asr': '我认为不同口音呢对语音识别的影响很大', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:26.555 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 14, 'asr': '我认为不同口音呢对语音识别的影响很大我们', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:26.959 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 14, 'asr': '我认为不同口音呢对语音识别的影响很大。我�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:26.986 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 15, 'asr': '需�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:27.260 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 15, 'asr': '需要首�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:27.361 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 15, 'asr': '需要首先做�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:27.665 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 15, 'asr': '需要首先做好这�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:27.867 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 15, 'asr': '需要首先做好这个泛�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:27.930 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 14, 'asr': '我认为不同口音呢对语音识别的影响很大。我�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'timestamp': 1735455866.9578614, 'speaker': '张明'}
2024-12-29 15:04:28.069 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 15, 'asr': '需要首先做好这个泛化能�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:28.371 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 15, 'asr': '需要首先做好这个泛化能力同�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:28.471 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 15, 'asr': '需要首先做好这个泛化能力同时针�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:28.976 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 15, 'asr': '需要首先做好这个泛化能力同时针对每一�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:29.497 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 15, 'asr': '需要首先做好这个泛患能力，同时针对每一种�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:29.525 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 16, 'asr': '或�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:29.684 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 16, 'asr': '或者每�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:29.783 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 16, 'asr': '或者每种翻�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:30.288 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 16, 'asr': '或者每种翻译做特定�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:30.498 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 15, 'asr': '需要首先做好这个泛患能力，同时针对每一种�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'timestamp': 1735455869.495097, 'speaker': '张明'}
2024-12-29 15:04:30.791 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 16, 'asr': '或者每种翻译做特定的训�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:30.893 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 16, 'asr': '或者每种翻译做特定的训练条�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:31.500 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 16, 'asr': '语音或者每种方言做特定的训练调优�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:31.904 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 17, 'asr': '说的', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:32.105 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 17, 'asr': '说的太好�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:32.423 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 16, 'asr': '语音或者每种方言做特定的训练调优�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'timestamp': 1735455871.4992013, 'speaker': '张明'}
2024-12-29 15:04:32.711 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 17, 'asr': '说的太好了准�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:32.910 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 17, 'asr': '说的太好了准确捕�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:33.011 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 17, 'asr': '说的太好了准确捕捉口�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:33.211 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 17, 'asr': '说的太好了准确捕捉口音特�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:33.514 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 17, 'asr': '说的太好了准确捕捉口音特点并专项', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:33.720 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 17, 'asr': '说的太好了准确捕捉口音特点并专项优化', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:34.251 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 17, 'asr': '说的太好了，准确捕捉口音特点并专项优化确�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:34.278 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 18, 'asr': '重要', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:34.626 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 18, 'asr': '重要那你', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:34.824 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 18, 'asr': '重要那你有没�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:34.925 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 18, 'asr': '重要那你有没有什�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:35.129 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 18, 'asr': '重要那你有没有什么创新的', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:35.328 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 18, 'asr': '重要那你有没有什么创新的想法', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:35.330 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 17, 'asr': '说的太好了，准确捕捉口音特点并专项优化确�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'timestamp': 1735455874.249513, 'speaker': '未知'}
2024-12-29 15:04:35.632 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 18, 'asr': '重要那你有没有什么创新的想法�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:35.732 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 18, 'asr': '重要那你有没有什么创新的想法来改�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:35.935 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 18, 'asr': '重要那你有没有什么创新的想法来改善这一�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:36.137 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 18, 'asr': '重要那你有没有什么创新的想法来改善这一点呢', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:36.692 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 18, 'asr': '是很重要。那你有没有什么创新的想法来改善这一点呢？�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:37.043 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 19, 'asr': '�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:37.345 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 19, 'asr': '我认�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:37.547 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 19, 'asr': '我认为呢', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:37.759 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 18, 'asr': '是很重要。那你有没有什么创新的想法来改善这一点呢？�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'timestamp': 1735455876.6906734, 'speaker': '未知'}
2024-12-29 15:04:37.851 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 19, 'asr': '我认为呢�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:38.053 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 19, 'asr': '我认为呢在大', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:38.152 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 19, 'asr': '我认为呢在大规模', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:38.354 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 19, 'asr': '我认为呢在大规模数据', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:38.559 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 19, 'asr': '我认为呢在大规模数据�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:38.658 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 19, 'asr': '我认为呢在大规模数据集之�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:38.964 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 19, 'asr': '我认为呢在大规模数据集之下首先做�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:39.411 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 19, 'asr': '我认为呢，在大规模数据集制下，首先之�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:39.441 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 20, 'asr': '方法能力', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:39.469 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 20, 'asr': '方法能力然后', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:39.768 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 20, 'asr': '方法能力然后针对�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:39.971 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 20, 'asr': '方法能力然后针对每一�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:40.171 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 20, 'asr': '方法能力然后针对每一种语�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:40.272 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 20, 'asr': '方法能力然后针对每一种语音呢', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:40.475 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 20, 'asr': '方法能力然后针对每一种语音呢做好', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:40.490 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 19, 'asr': '我认为呢，在大规模数据集制下，首先之�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'timestamp': 1735455879.4094484, 'speaker': '张明'}
2024-12-29 15:04:40.982 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 20, 'asr': '方法能力然后针对每一种语音呢做好声音', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:41.081 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 20, 'asr': '方法能力然后针对每一种语音呢做好声音�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:41.282 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 20, 'asr': '方法能力然后针对每一种语音呢做好声音的兵�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:41.383 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 20, 'asr': '方法能力然后针对每一种语音呢做好声音的兵兵马', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:41.587 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 20, 'asr': '方法能力然后针对每一种语音呢做好声音的兵兵马骑兵�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:42.039 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 20, 'asr': '放管能力，然后针对每一种语音呢做好呃声音的编编码机解码齐�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:42.093 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 21, 'asr': '那兵�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:42.192 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 21, 'asr': '那兵马器', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:42.394 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 21, 'asr': '那兵马器编码�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:42.596 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 21, 'asr': '那兵马器编码器呢这种', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:42.697 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 21, 'asr': '那兵马器编码器呢这种传统', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:42.899 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 21, 'asr': '那兵马器编码器呢这种传统�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:43.000 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 21, 'asr': '那兵马器编码器呢这种传统的能�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:43.163 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 20, 'asr': '放管能力，然后针对每一种语音呢做好呃声音的编编码机解码齐�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'timestamp': 1735455882.0372124, 'speaker': '张明'}
2024-12-29 15:04:43.408 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 21, 'asr': '那兵马器编码器呢这种传统的能力我觉得', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:43.712 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 21, 'asr': '那兵马器编码器呢这种传统的能力我觉得最主要�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:43.813 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 21, 'asr': '那兵马器编码器呢这种传统的能力我觉得最主要的就�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:44.016 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 21, 'asr': '那兵马器编码器呢这种传统的能力我觉得最主要的就是说', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:44.218 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 21, 'asr': '那兵马器编码器呢这种传统的能力我觉得最主要的就是说现在', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:44.461 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 21, 'asr': '那编码器解码器呢是一种传统的能力。我觉得最主要的就是说现在�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:44.520 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 22, 'asr': '需�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:44.823 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 22, 'asr': '需要通过', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:45.029 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 22, 'asr': '需要通过人工智能', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:45.325 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 22, 'asr': '需要通过人工智能做好', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:45.425 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 22, 'asr': '需要通过人工智能做好这个', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:45.556 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 21, 'asr': '那编码器解码器呢是一种传统的能力。我觉得最主要的就是说现在�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'timestamp': 1735455884.459901, 'speaker': '张明'}
2024-12-29 15:04:45.840 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 22, 'asr': '需要通过人工智能做好这个�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:45.930 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 22, 'asr': '需要通过人工智能做好这个没有', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:46.133 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 22, 'asr': '需要通过人工智能做好这个没有发银�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:46.436 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 22, 'asr': '需要通过人工智能做好这个没有发银的方法能', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:46.635 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 22, 'asr': '需要通过人工智能做好这个没有发银的方法能�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:47.176 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 22, 'asr': '需要通过人工智能做好这个每种发译的泛化能力�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:47.542 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 23, 'asr': '很有鉴定', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:48.045 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 23, 'asr': '很有鉴定�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:48.175 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 22, 'asr': '需要通过人工智能做好这个每种发译的泛化能力�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'timestamp': 1735455887.1747599, 'speaker': '张明'}
2024-12-29 15:04:48.248 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 23, 'asr': '很有鉴定提升', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:48.346 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 23, 'asr': '很有鉴定提升模型�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:48.548 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 23, 'asr': '很有鉴定提升模型的泛�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:48.651 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 23, 'asr': '很有鉴定提升模型的泛化能�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:48.850 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 23, 'asr': '很有鉴定提升模型的泛化能力确�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:49.052 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 23, 'asr': '很有鉴定提升模型的泛化能力确实是', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:49.153 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 23, 'asr': '很有鉴定提升模型的泛化能力确实是关键', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:49.676 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 23, 'asr': '很有见地，提升模型的泛化能力确实是关键�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:49.702 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 24, 'asr': '那你觉得', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:49.863 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 24, 'asr': '那你觉得�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:49.958 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 24, 'asr': '那你觉得强化�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:50.160 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 24, 'asr': '那你觉得强化学习', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:50.262 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 24, 'asr': '那你觉得强化学习�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:50.463 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 24, 'asr': '那你觉得强化学习能在', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:50.666 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 24, 'asr': '那你觉得强化学习能在语音识别', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:50.768 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 24, 'asr': '那你觉得强化学习能在语音识别�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:50.769 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 23, 'asr': '很有见地，提升模型的泛化能力确实是关键�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'timestamp': 1735455889.674548, 'speaker': '未知'}
2024-12-29 15:04:50.971 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 24, 'asr': '那你觉得强化学习能在语音识别中起�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:51.072 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 24, 'asr': '那你觉得强化学习能在语音识别中起到什么作�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:51.274 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 24, 'asr': '那你觉得强化学习能在语音识别中起到什么作用呢', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:52.005 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 24, 'asr': '那你觉得强化学习能在语音识别中起到什么作用呢�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:52.581 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 25, 'asr': '�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:52.684 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 25, 'asr': '是最大的', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:52.884 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 25, 'asr': '是最大的作用', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:52.969 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 24, 'asr': '那你觉得强化学习能在语音识别中起到什么作用呢�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'timestamp': 1735455892.0036695, 'speaker': '未知'}
2024-12-29 15:04:53.085 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 25, 'asr': '是最大的作用呢就�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:53.490 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 25, 'asr': '是最大的作用呢就是这', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:53.693 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 25, 'asr': '是最大的作用呢就是这�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:54.427 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 25, 'asr': '陈老其习最大的作用呢就是这个�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:54.700 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 26, 'asr': '�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:54.801 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 26, 'asr': '你给�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:55.003 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 26, 'asr': '你给我说一�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:55.103 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 26, 'asr': '你给我说一下吧', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:55.308 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 26, 'asr': '你给我说一下吧我不知道', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:55.380 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 25, 'asr': '陈老其习最大的作用呢就是这个�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'timestamp': 1735455894.425944, 'speaker': '张明'}
2024-12-29 15:04:55.507 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 26, 'asr': '你给我说一下吧我不知道�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:56.090 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 26, 'asr': '哎，你给我说一下吧，我不知道哎嗯�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:56.614 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 27, 'asr': '哈哈', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:56.715 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 27, 'asr': '哈哈�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:56.919 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 27, 'asr': '哈哈没关�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:57.015 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 26, 'asr': '哎，你给我说一下吧，我不知道哎嗯�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'timestamp': 1735455896.0891132, 'speaker': '张明'}
2024-12-29 15:04:57.524 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 27, 'asr': '哈哈没关系强化学', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:57.726 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 27, 'asr': '哈哈没关系强化学�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:57.927 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 27, 'asr': '哈哈没关系强化学习可�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:58.029 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 27, 'asr': '哈哈没关系强化学习可以在语音', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:58.230 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 27, 'asr': '哈哈没关系强化学习可以在语音识别', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:58.330 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 27, 'asr': '哈哈没关系强化学习可以在语音识别中优', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:58.805 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 27, 'asr': '哈哈，没关系，强化学习可以在语音识别中优。�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:58.836 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 28, 'asr': '模型�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:58.866 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 28, 'asr': '模型的决�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:59.035 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 28, 'asr': '模型的决策过�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:59.338 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 28, 'asr': '模型的决策过程比�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:59.539 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 28, 'asr': '模型的决策过程比如提�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:59.641 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 28, 'asr': '模型的决策过程比如提升对', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:59.842 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 28, 'asr': '模型的决策过程比如提升对复杂', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:59.942 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 28, 'asr': '模型的决策过程比如提升对复杂语境�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:04:59.943 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 27, 'asr': '哈哈，没关系，强化学习可以在语音识别中优。�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'timestamp': 1735455898.8031864, 'speaker': '未知'}
2024-12-29 15:05:00.143 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 28, 'asr': '模型的决策过程比如提升对复杂语境的理�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:05:00.647 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 28, 'asr': '模型的决策过程比如提升对复杂语境的理解你平时', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:05:00.748 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 28, 'asr': '模型的决策过程比如提升对复杂语境的理解你平时�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:05:00.955 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 28, 'asr': '模型的决策过程比如提升对复杂语境的理解你平时会关�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:05:01.382 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 28, 'asr': '化模型的决策过程，比如提升对复杂语境的理解。你平时会关注哪�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:05:01.410 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 29, 'asr': '技�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:05:01.455 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 29, 'asr': '技术博�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:05:01.556 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 29, 'asr': '技术博客或', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:05:01.758 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 29, 'asr': '技术博客或论文', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:05:01.958 | INFO     | __main__:receive_recognition_result:73 - {'type': 'asr', 'rt': [], 'is_final': False, 'seg_id': 29, 'asr': '技术博客或论文�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'translate': ''}
2024-12-29 15:05:02.508 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 28, 'asr': '化模型的决策过程，比如提升对复杂语境的理解。你平时会关注哪�?, 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'timestamp': 1735455901.380705, 'speaker': '未知'}
2024-12-29 15:05:02.508 | WARNING  | __main__:receive_recognition_result:71 - {'type': 'asr', 'rt': [], 'is_final': True, 'seg_id': 29, 'asr': '哪些技术博客或论文呢？', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b'}
2024-12-29 15:05:03.303 | INFO     | __main__:receive_recognition_result:73 - {'type': 'voiceprint', 'seg_id': 29, 'asr': '哪些技术博客或论文呢？', 'task_id': '99605de3-935b-45c6-8f99-45f0bc7b697b', 'timestamp': 1735455902.5058944, 'speaker': '未知'}
receive_recognition_result error: ConnectionClosedOK(Close(code=1000, reason=''), Close(code=1000, reason=''), True)
```

