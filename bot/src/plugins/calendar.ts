import { MiraiBot } from "../bot/Bot";
import Axios from "axios";
import dayjs from "dayjs";
import ch from "dayjs/locale/zh-cn";
import relativeTime from "dayjs/plugin/relativeTime";
import localizedFormat from "dayjs/plugin/localizedFormat";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(localizedFormat);
dayjs.extend(relativeTime);
dayjs.locale(ch);

type Event = {
  name: string;
  website: string;
  id: string[];
  start: string;
  end: string;
};

const format = (d: dayjs.Dayjs) => d.format("MMMD ddd HH:mm");

export default function CalendarPlugin(bot: MiraiBot) {
  bot.registerCommand(
    {
      cmd: "calendar",
      help: "calendar [today|recent(default))]",
      verify: (msg, cmd, args) => !args || ["today", "recent"].includes(args),
    },
    async (msg, cmd, args) => {
      const d = (
        await Axios.get("https://api.yoshino-s.online/calendar/recent")
      ).data as Event[];
      if (!args || args === "recent") {
        return (
          "近期的比赛有:\n" +
          d
            .map(
              (d) =>
                `${d.name}:\n${d.website}\n开始时间:${format(
                  dayjs(d.start).utcOffset(8)
                )}\n结束时间:${format(dayjs(d.end).utc().utcOffset(8))}`
            )
            .join("\n\n")
        );
      } else {
        return (
          "现在正在举办的的比赛有:\n" +
          d
            .filter(
              (d) =>
                new Date(d.start).getTime() <= Date.now() &&
                Date.now() <= new Date(d.end).getTime()
            )
            .map(
              (d) =>
                `${d.name}:\n${d.website}\n开始时间:${format(
                  dayjs(d.start).utcOffset(8)
                )}\n结束时间:${format(dayjs(d.end).utc().utcOffset(8))}`
            )
            .join("\n\n")
        );
      }
    }
  );
}
