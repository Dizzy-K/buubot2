import { MiraiBot } from "./Bot";
import { MessageType } from "mirai-ts";
import { unserialize } from "./serialization";
import { MapStorage, TargetSetStorage } from "./utils/storage";
import { extractTarget, Target } from "./utils/utils";

/**
 * 0b00000001 friend
 * 0b00000010 group member
 * 0b00000100 group admin
 * 0b00001000 group owner
 * 0b00010000 temp chat
 */
export enum CommandPermission {
  friend = 0b00000001,
  group = 0b00001110,
  member = 0b00000010,
  admin = 0b00001100,
  administrator = 0b00000100,
  owner = 0b00001000,
  temp = 0b00010000,
}

export interface MiraiBotCommandConfig {
  cmd: string;
  rule?: CommandPermission;
  alias?: string[] | string;
  help?: string;
  verify?: (msg: MessageType.ChatMessage, cmd: string, args: string) => boolean;
  specialRule?: Record<string, CommandPermission>;
}

export type CmdHook = (
  msg: MessageType.ChatMessage,
  cmd: string,
  args: string
) => any;

export default class MiraiBotCommand {
  config: MiraiBotCommandConfig;
  hook: CmdHook;
  specialRules: MapStorage<number, CommandPermission>;
  constructor(
    private readonly bot: MiraiBot,
    cmd: string | MiraiBotCommandConfig,
    hook: CmdHook
  ) {
    if (typeof cmd === "string") {
      this.config = {
        cmd,
      };
    } else {
      this.config = cmd;
      if (cmd.verify) this.verifyArgs = cmd.verify;
    }
    this.hook = hook;
    this.specialRules = new MapStorage("cmd_rule:" + this.config.cmd);
  }

  setRule(groupId: number, rule: CommandPermission) {
    console.log(groupId, rule);
    return this.specialRules.set(groupId, rule);
  }

  async getRule(groupId?: number): Promise<CommandPermission> {
    return (
      (groupId && (await this.specialRules.get(groupId))) ??
      (this.config.rule ||
        CommandPermission.friend |
          CommandPermission.group |
          CommandPermission.temp)
    );
  }

  async run(msg: MessageType.ChatMessage, cmd: string, args: string) {
    if (cmd !== this.config.cmd && !this.config.alias?.includes(cmd)) {
      return;
    }
    if (msg.sender.id !== this.bot.config.privilege) {
      const rule = await this.getRule(
        msg.type !== "FriendMessage" ? msg.sender.group.id : undefined
      );
      if (msg.type === "FriendMessage" && !(rule & CommandPermission.friend))
        return;
      if (msg.type === "GroupMessage") {
        if (
          msg.sender.permission === "MEMBER" &&
          !(rule & CommandPermission.member)
        )
          return;
        if (
          msg.sender.permission === "ADMINISTRATOR" &&
          !(rule & CommandPermission.administrator)
        )
          return;
        if (
          msg.sender.permission === "OWNER" &&
          !(rule & CommandPermission.owner)
        )
          return;
      }
      if (msg.type === "TempMessage" && !(rule & CommandPermission.temp))
        return;
    }
    if (!this.verifyArgs(msg, cmd, args)) {
      await msg.reply(this.help);
      return;
    }
    const res = await this.hook(msg, cmd, args);
    if (res === MiraiBotCommand.HelpSymbol) {
      await msg.reply(unserialize(this.help));
    } else if (res !== undefined) {
      await msg.reply(unserialize(String(res)));
    }
  }
  get help(): string {
    return (
      "Usage: " +
      this.bot.config.commandPrefix +
      (this.config.help || this.config.cmd)
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  verifyArgs(msg: MessageType.ChatMessage, cmd: string, args: string) {
    return true;
  }

  static readonly HelpSymbol = Symbol("help");
}

export class SwitchCommand extends MiraiBotCommand {
  set: TargetSetStorage;
  constructor(
    bot: MiraiBot,
    cmd: string,
    set: TargetSetStorage,
    explicit = true,
    hook?: (target: Target, status: boolean) => any
  ) {
    super(
      bot,
      {
        cmd,
        help: `${cmd} on|off`,
        rule: CommandPermission.admin | CommandPermission.friend,
        verify: (msg, cmd, args) => ["on", "off"].includes(args),
      },
      async (msg: MessageType.ChatMessage, cmd: string, args: string) => {
        console.log(msg);
        const target = extractTarget(msg, explicit);
        if (args === "on") {
          await this.set.add(target);
        } else {
          await this.set.remove(target);
        }
        hook?.(target, args === "on");
        return "OK";
      }
    );
    this.set = set;
  }
}
