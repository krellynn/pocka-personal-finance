import {describe,expect,it} from "vitest";
import {todayInTimeZone} from "./todayInTimeZone";
describe("todayInTimeZone",()=>{it("uses the requested timezone rather than UTC date slicing",()=>expect(todayInTimeZone("Asia/Jakarta",new Date("2026-11-22T18:30:00.000Z"))).toBe("2026-11-23"));});