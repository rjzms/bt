# 卡片背题页面 v3

这是一个纯前端 GitHub Pages 背题页面，支持一个仓库里放多个 JSON 题库文件。

## 使用方式

1. 把 `index.html`、`styles.css`、`app.js` 上传到 GitHub 仓库根目录。
2. 把任意多个题库 JSON 也上传到仓库根目录，例如：
   - `javaee.json`
   - `machine_learning.json`
   - `chapter1.json`
3. 开启 GitHub Pages。
4. 打开页面后，填写 GitHub 用户名、仓库名、分支，点击“保存仓库设置”。
5. 页面会自动读取仓库里的所有 `.json` 文件。

如果你想把 JSON 放在文件夹里，比如 `data/`，就在页面的“JSON 目录”里填写 `data`。

## JSON 格式

支持数组格式：

```json
[
  {
    "id": 1,
    "type": "简答题",
    "q": "请简述什么是 MyBatis？",
    "a": "MyBatis 是一个 Java 持久层框架……",
    "desc": "熟背关键词：持久层框架、封装 JDBC、SQL 映射。"
  }
]
```

单选题也支持：

```json
{
  "id": 1,
  "type": "单选题",
  "q": "题目",
  "opts": {"A":"选项A", "B":"选项B"},
  "a": "A",
  "desc": "解析"
}
```

## 关于删除

GitHub Pages 是静态网页，网页不能直接删除 GitHub 仓库文件。

- 你在 GitHub 仓库删除某个 JSON 文件后，页面点“刷新题库列表”，它就不会再显示。
- 页面内删除题目只是本地隐藏；要同步到 GitHub，需要导出 JSON 后上传替换原文件。
