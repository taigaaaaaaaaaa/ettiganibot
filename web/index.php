<?php ?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <title>ettiganibot-dashboard</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body>

    <!-- ローディング画面 -->
    <div id="loading">
        <div class="loading-crab">🦀</div>
        <p class="loading-text">loading...</p>

        <div class="loading-bar">
            <div class="loading-bar-fill"></div>
        </div>

        <p id="welcome-text" style="display:none;">ようこそ、えっちがにbotへ</p>
    </div>

    <!-- サイドバー -->
    <div class="sidebar">
        <a class="sidebar-title" onclick="loadPage('home.php')">えっちがにbot</a>
        <div class="sidebar-line"></div>

        <a class="sidebar-item" onclick="loadPage('api/log_view.php')">📜 ログを見る</a>
        <a class="sidebar-item" onclick="loadPage('api/log.php')">📡 ステータス確認</a>
        <a class="sidebar-item" onclick="loadPage('api/total.php')">🧪 APIテスト</a>
    </div>

    <!-- 本体（iframeで切り替え） -->
    <div id="content" class="main-content" style="display:none;">
        <iframe id="mainFrame" src="home.php" class="main-frame"></iframe>
    </div>

    <script src="js/main.js"></script>
</body>
</html>
