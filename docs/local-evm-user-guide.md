# 普通用户操作指南

当前 6 个作品、16 个版本已经有可重放备份，Work 4 的三版完整。电脑目前保持运行，本轮没有停止现有节点。

## 什么时候可以关机

停止开发后，在 `D:\HKS` 执行：

```powershell
npm run backup:chain:local
```

记下输出的 **新文件名**，再执行：

```powershell
npm run verify:backup:local -- "这里填写刚生成的 JSON 路径"
```

确认校验成功，JSON 和相邻 `.sha256` 文件都已保存，且此后没有新交易，才关机。节点内存会消失；备份能够恢复其覆盖的数据。突然断电时，最后一次备份后的操作可能丢失。

## 下次开机

在 `D:\HKS` 使用最新通过校验的备份。当前可用示例：

```powershell
npm run resume:version:local -- ".local-evm/backups/chain31337-2026-10-13T01-29-12-455Z-e0988bf6.json"
```

这是检查，不会启动服务。确认成功、旧服务已停止后执行：

```powershell
npm run resume:version:local -- ".local-evm/backups/chain31337-2026-10-13T01-29-12-455Z-e0988bf6.json" --start
```

若提示端口占用，不要强行关闭或重置未知进程。先确认是不是现有开发服务；正在运行时继续使用它即可。以后产生新备份时，把命令中的路径替换成你最近校验过的路径。

## 怎样确认 Work 4

打开 [本地 Work 4](http://127.0.0.1:3002/local-evm/works/4)。应显示本地链来源、Version Count=3，三个版本前驱为 0、1、2。详情 Hash 应与 [核对基准](local-evm-recovery-baseline.md) 一致。

## 如果 Work 4 不见了

先停止追加，不删除任何文件、不运行初始化或 reset。可能是误开新空链或选错备份。先验证备份，再执行独立检查：

```powershell
npm run restore:chain:isolated -- ".local-evm/backups/chain31337-2026-10-13T01-29-12-455Z-e0988bf6.json" --apply
```

这只在独立 18545 端口测试，结束自动关闭，不替换你当前的节点。检查通过后，再决定何时停止旧服务并用恢复入口继续开发。

保留整个 `.local-evm/backups`、deployment.json 和项目；备份被 Git 忽略，需要另外复制保存。旧的 `local-history-snapshot.json` 清单不能单独恢复原链。完整说明见 [备份与恢复说明](local-evm-backup-recovery.md)。
