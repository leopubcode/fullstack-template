import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "./trpc";

export const Test = () => {
  const trpc = useTRPC();
  const result = useQuery(trpc.userList.queryOptions({ name: "wuut" }));
  console.log(result.data);

  return (
    <div>
      <h1 className="text-3xl font-bold underline bg-red-400">Hello world!</h1>
      hey sir {result.data?.map((n) => n.displayName)}
    </div>
  );
};
