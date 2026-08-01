const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const epubPath = 'D:/Claude code/project/电子阅读器/public/test.epub';

async function buildEpub() {
  const zip = new JSZip();

  // mimetype must be first, stored without compression
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

  // META-INF/container.xml
  zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);

  // content.opf
  zip.file('content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">test-mystery-001</dc:identifier>
    <dc:title>测试书籍</dc:title>
    <dc:creator>凌晨</dc:creator>
    <dc:language>zh-CN</dc:language>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch2" href="ch2.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch3" href="ch3.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch4" href="ch4.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch5" href="ch5.xhtml" media-type="application/xhtml+xml"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="nav"/>
    <itemref idref="ch1"/>
    <itemref idref="ch2"/>
    <itemref idref="ch3"/>
    <itemref idref="ch4"/>
    <itemref idref="ch5"/>
  </spine>
</package>`);

  // nav.xhtml
  zip.file('nav.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>目录</title></head>
<body>
  <nav epub:type="toc">
    <h1>目录</h1>
    <ol>
      <li><a href="ch1.xhtml">第一章 匿名信</a></li>
      <li><a href="ch2.xhtml">第二章 列车上的陌生人</a></li>
      <li><a href="ch3.xhtml">第三章 血染包厢</a></li>
      <li><a href="ch4.xhtml">第四章 蛛丝马迹</a></li>
      <li><a href="ch5.xhtml">第五章 真相大白</a></li>
    </ol>
  </nav>
</body>
</html>`);

  // toc.ncx
  zip.file('toc.ncx', `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="test-mystery-001"/></head>
  <docTitle><text>测试书籍</text></docTitle>
  <navMap>
    <navPoint id="nav-1" playOrder="1"><navLabel><text>第一章 匿名信</text></navLabel><content src="ch1.xhtml"/></navPoint>
    <navPoint id="nav-2" playOrder="2"><navLabel><text>第二章 列车上的陌生人</text></navLabel><content src="ch2.xhtml"/></navPoint>
    <navPoint id="nav-3" playOrder="3"><navLabel><text>第三章 血染包厢</text></navLabel><content src="ch3.xhtml"/></navPoint>
    <navPoint id="nav-4" playOrder="4"><navLabel><text>第四章 蛛丝马迹</text></navLabel><content src="ch4.xhtml"/></navPoint>
    <navPoint id="nav-5" playOrder="5"><navLabel><text>第五章 真相大白</text></navLabel><content src="ch5.xhtml"/></navPoint>
  </navMap>
</ncx>`);

  // Chapter texts
  const ch1Text = [
    `深秋的夜晚，北风裹着落叶拍打着站台上稀疏的旅客。林深紧了紧风衣领口，从口袋里掏出那封已经揉皱的信。信纸是昂贵的棉浆纸，字迹工整却透着一股刻意控制的颤抖——或者说，兴奋。`,
    `"林深先生，若你想知道三年前碧湖案的真相，请乘坐十一月七日晚十一点十五分的K739次列车。7号包厢。一个知情人。"`,
    `没有署名，没有地址。碧湖案是林深心里一根拔不掉的刺——他的搭档在调查那起案件时殉职，而案件至今悬而未决。三年来林深翻遍了每一份卷宗，询问了每一个相关的人，却总是在最接近答案的时候撞上一堵无形的墙。`,
    `十一点整，K739次列车准时进站。这是一列老式的绿皮火车，在高铁时代显得格格不入，但林深注意到车身的漆面被重新粉刷过，车窗一尘不染。列车一共八节车厢，他在乘务员的指引下找到了自己的铺位。`,
    `车厢里弥漫着淡淡的檀木香气，走廊铺着暗红色的地毯，踩上去悄无声息。经过6号包厢时，门虚掩着，里面透出暖黄色的灯光和一个女人低声哼唱的声音。他在7号包厢门口停下，深吸一口气，推开了门。包厢不大，靠窗的桌上放着一盏黄铜台灯和一本摊开的阿加莎·克里斯蒂小说——书签恰好夹在东方快车谋杀案那一章。`
  ];

  const ch2Text = [
    `列车缓缓启动，窗外的城市灯火逐渐被荒野的黑暗吞噬。林深坐在包厢里，将那封信反复查看。敲门声突然响起——两短一长，像某种暗号。他拉开门的瞬间，走廊的灯恰好熄灭了一秒，只来得及看清来人的轮廓。`,
    `一个身材高挑的女人站在门口，穿着藏青色的旗袍，鬓边别着一朵白花。"林侦探。"她的声音很轻，仿佛怕被第三个人听见，"我叫苏晚晴。我父亲是三年前碧湖案中——"她停顿了一下，环顾左右，压低声音，"——被灭口的证人。"`,
    `林深侧身让她进来，目光扫过走廊尽头——一个穿列车员制服的男人正站在那里，胸前的名牌反着光，看不清上面的字。`,
    `苏晚晴坐下来，手指紧紧攥着手包的金属扣。"有人不希望你继续调查碧湖案。这趟列车上的每一个人，似乎都和三年前的案件有着千丝万缕的联系。"她的话被走廊里由远及近的脚步声打断。`,
    `高跟鞋的声响——笃，笃，笃。然后是一个男人低沉的咳嗽。林深迅速示意她噤声。脚步声在7号包厢门口停了一瞬，随即继续向车尾方向走去。`,
    `"晚上在餐车，"苏晚晴起身时递给他一张叠成方胜的纸条，"八点，我会给你看证据。"她拉开门，消失在走廊的暗红色灯光里。林深展开纸条，上面只写了两个名字——周克寒，碧湖案的首席检察官。以及一个他不认识的名字。`,
    `晚上七点半，林深提前来到餐车。水晶吊灯轻轻摇晃，将光影洒在白色桌布上。戴金丝眼镜的瘦削男人坐在角落读报，不时用铅笔在字里行间做记号。穿着昂贵西装的胖男人独自占据了一张四人桌，面前摆着半瓶红酒和两份牛排。还有那个列车员，正背对着门口擦杯子。林深看清了他的名牌——陈默。`
  ];

  const ch3Text = [
    `八点整，苏晚晴没有出现。八点十分，依然没有任何动静。林深起身前往她的包厢——3号。门从里面反锁着。他用力拍门，没有人应答。`,
    `叫来陈默用万能钥匙开门时，八点一刻的钟声刚好响起。冷风从大开的窗户灌入，将桌上的稿纸吹得到处都是。苏晚晴倒在地板上，面色安详，仿佛睡着了一般。但她的右手紧握成拳，左手边散落着几片撕碎的泛黄照片。`,
    `林深蹲下触摸她的颈动脉——已经没有脉搏。没有血迹，没有外伤，空气中残留着一丝苦杏仁的气味。氰化物。死亡时间不超过半小时。`,
    `列车上的广播突然响了，是列车长平稳的播报声。陈默低声说："下一站还有两个小时。这期间没有人能离开列车。"林深抬头看着他，发现这个列车员的眼神异常冷静，甚至可以说是——早有预料。`,
    `"你认识她？"林深问。陈默没有回答，而是从口袋里掏出一块干净的白手帕，轻轻盖在了苏晚晴的脸上。"三年前，有一个列车员在碧湖边发现了一具尸体。警方定性为自杀。"他将手帕的边角仔细掖好，"那个列车员，是我哥哥。"`,
    `林深快步回到餐车。金丝眼镜还在读报——他甚至没有抬头看林深。胖男人已经喝掉了半瓶红酒，正用叉子烦躁地戳着第二份牛排。"周克寒先生？"林深直接开口。对方的手猛地停在半空，油渍溅到了领带上。"你是谁？怎么知道我——""我叫林深，调查碧湖案的。"`,
    `话音落下的瞬间，整个餐车陷入了死寂。金丝眼镜合上了报纸，取下了眼镜，露出一双鹰隼般锋利的眼睛。"有意思，"他说，"我是韩亭，省厅刑侦处的。看来今晚这趟列车，是有人精心安排的一场聚会。"`
  ];

  const ch4Text = [
    `韩亭从公文包里取出一个牛皮纸档案袋，里面是三年前碧湖案的全部卷宗——他随身携带，说明他也收到了邀请。`,
    `"卷宗里有一处被篡改过的地方，"韩亭翻开一页，指着一段涂改过的证词，"目击者苏远志——就是苏晚晴的父亲——在笔录中说，案发当晚他看到一个穿制服的人在湖边，但这句话被人用墨水划掉了，改成了未发现可疑人员。"`,
    `林深感到脊背发凉。制服——可以是警察，可以是保安，也可以是列车员。他想起了走廊尽头那个沉默的男人，和他胸前反着光的名牌。`,
    `"周先生，"林深转向胖男人，"你当时负责碧湖案的起诉工作。为什么在苏远志意外死亡后，案件以证据不足为由撤诉了？"周克寒的额头渗出细密的汗珠，端起酒杯想喝，却发现杯子已经空了。"我……我只是按上面的意思办事。"他的目光躲闪，"苏远志的心脏病发作是意外，法医报告写得很清楚——"`,
    `"但苏远志没有心脏病史，"韩亭冷冷地打断他，从卷宗里抽出一张体检报告复印件，"这是他死前三个月的入职体检，各项指标正常。"餐车忽然晃了一下——列车正在通过弯道。红酒瓶倒在桌布上，像一摊正在蔓延的暗色血迹。`,
    `林深决定返回3号包厢重新检查现场。走廊里暗红色的地毯在脚下发出轻微的沙沙声。经过6号包厢时，他再次听到了那阵女人的哼唱声——这次他听清了曲调，是二十年前流行的一首老歌，关于一个等待丈夫归来的妻子。`,
    `忽然，一阵刺痛从后颈传来，像是被什么东西扎了一下。他猛地转身，只看到一个人影消失在车厢连接处。伸手摸向后颈时，指尖沾上了一滴血。地上躺着一支细如发丝的钢针，针尖泛着淡淡的光泽。`
  ];

  const ch5Text = [
    `凌晨一点，林深将所有活着的人召集到餐车。后颈的伤口还在隐隐作痛，但他的思路从未如此清晰。`,
    `"苏远志在碧湖边看到的穿制服的人，不是警察，"他开口时目光扫过在场的每一个人，"而是一个穿列车员制服的人。他那天恰好从碧湖边经过——不是偶然经过，而是去处理他刚杀死的人。"林深的目光落在陈默身上，后者端坐在椅子上，双手平放在膝盖上，姿态近乎军人的标准。`,
    `"苏晚晴的纸条上写了两行字——第一行是周克寒，第二行是陈默。我一开始以为她列的是要调查的人。但后来我明白了——她列的是碧湖案的关联者。陈默的哥哥无意中目击了弟弟在湖边处理尸体。他报了警。警方赶到时，凶手早已离开。但他哥哥在警局作证时，描述了列车员制服上的铜扣图案。"`,
    `苏远志在旁听时听到了这段描述并记录下来。这份记录被周克寒刻意从卷宗中抹除。韩亭从档案袋里抽出一张早已泛黄的旁听证——上面的签名正是苏远志。`,
    `陈默缓缓站起身，但并没有逃跑。"我哥哥是个好人。他以为自己在做正确的事。"他的声音平静得可怕，"但那个被我杀掉的人——他害死了十二个人，包括我们的母亲。碧湖底下沉着一辆面包车，车里是十二具被高利贷逼死的尸体。"`,
    `"警方拖了三年没能破案，因为有人收了钱，把证据一一抹掉了。"他望向周克寒，后者缩在椅子上，面色惨白。`,
    `"我的错，"陈默最后说，"在于我以为杀掉一个坏人就能伸张正义。但我哥哥死后，我才明白——当你用一个错误去纠正另一个错误时，只会制造更多的错误。"他伸出手腕，朝向韩亭。`,
    `列车在旷野中飞驰，窗外的天边已经露出了微光。黎明即将到来，但有些人永远留在了这个漫长的夜晚。`
  ];

  const chapters = [
    { id: 'ch1', title: '第一章 匿名信', lines: ch1Text },
    { id: 'ch2', title: '第二章 列车上的陌生人', lines: ch2Text },
    { id: 'ch3', title: '第三章 血染包厢', lines: ch3Text },
    { id: 'ch4', title: '第四章 蛛丝马迹', lines: ch4Text },
    { id: 'ch5', title: '第五章 真相大白', lines: ch5Text },
  ];

  let totalChars = 0;
  for (const ch of chapters) {
    const html = ch.lines.map((p) => `<p>${p}</p>`).join('\n  ');
    for (const l of ch.lines) totalChars += l.length;
    zip.file(ch.id + '.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${ch.title}</title></head>
<body>
  <h2>${ch.title}</h2>
  ${html}
</body>
</html>`);
  }

  // Generate EPUB as Node buffer
  const data = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
    mimeType: 'application/epub+zip',
  });

  fs.writeFileSync(epubPath, data);
  console.log('EPUB created:', data.length, 'bytes,', totalChars, 'chars');
}

buildEpub().catch((err) => {
  console.error('EPUB build failed:', err);
  process.exit(1);
});
