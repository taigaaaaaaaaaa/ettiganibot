<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <title>トップページ</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body class="home-body">

    <div class="home-container">
        <h1 class="home-title">ようこそ、えっちがにbotへ</h1>

        <p class="home-description">
            このbotはたいがによって作られました。このサイトもね。<br>
            このbotの機能は、キウイの鯖で/helpと打つと確認できます。<br>
            このサイトのURLを取得するのに1700円という大金を払いました！！！！！いっぱい見てね！約束だよ！！！！！
        </p>

        <h2 class="home-news-title">お知らせ</h2>

        <div class="home-news-box">
            <p>
                webサイト作成中！どんどん進化していく予定です。<br>
                とりあえずサイトの見た目だけ作りました。右のメニュー欄はまだ機能していません。ご了承を。<br>
                2026/07/06 えっちがにbotのログがサイトから閲覧できるようになりました！<br>
                左のメニュー欄からご覧ください✨
            </p>
        </div>
    </div>

    <div style="margin-top:15px;">
        <iframe 
            width="100%" 
            height="420" 
            src="https://www.youtube.com/embed/qSu-c-fiTG0?autoplay=1&mute=1&loop=1&playlist=qSu-c-fiTG0"
            title="YouTube video player"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen>
        </iframe>
    </div>

    <div class="home-news-box" style="margin-top:20px;">
        <h3 style="margin-top:0;">歌詞</h3>

        <p style="line-height:1.8;">
            🛬 エッチな蟹、４選‼️‼️<br><br>

            ① エッチガニ🦀‼️‼️‼️<br>
            エッチガニ🦀は、エッチ‼️‼️<br><br>

            ② 毛ガニ🦀<br><br>

            ③ どこにも居場所が無い蟹🦀<br>
            みんな、誰と、どうやって、寄り添うんだろう。<br>
            あたしにはわかんないや。<br><br>

            ④ スケベガニ🦀<br>
            イェーイ!!/
        </p>
    </div>

    <h2 class="home-news-title" style="margin-top:40px;">総えっちがに数✨（リアルタイムで更新されます...！）</h2>

    <div id="totalBox" class="home-news-box" style="padding:30px; font-size:40px; text-align:center;">
        読み込み中…
    </div>

    <script>
    async function loadTotalJson() {
        try {
            const response = await fetch("api/total.php");
            const data = await response.json();

            let total = 0;
            for (const user in data) {
                total += data[user];
            }

            document.getElementById("totalBox").innerHTML = `
                <p style="font-size:48px; font-weight:bold;">
                    ${total} えっちがに✨
                </p>
            `;
        } catch (e) {
            document.getElementById("totalBox").innerHTML = "total.json を読み込めませんでした。";
        }
    }

    loadTotalJson();
    setInterval(loadTotalJson, 5000);
    </script>

</body>
</html>
