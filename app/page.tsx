import Link from "next/link";
import { getAllPosts } from "../utils/posts";

export default function Home() {
  const posts = getAllPosts().sort((a, b) => {
    const [dayA, monthA, yearA] = a.date.split("/").map(Number);
    const [dayB, monthB, yearB] = b.date.split("/").map(Number);

    const dateA = new Date(yearA, monthA - 1, dayA);
    const dateB = new Date(yearB, monthB - 1, dayB);

    return dateB.getTime() - dateA.getTime();
  });
  return (
    <div className="relative h-screen">
      <div className="absolute inset-0 bg-[url('/wp.png')] bg-cover bg-center bg-no-repeat opacity-15 z-0"></div>
      <div className="relative z-10 font-sans flex flex-col gap-4 mx-12 sm:mx-32 h-full">
        <div className="flex font-medium items-center justify-center pt-10 pb-8 border-b border-gray-400">
          <Link href="/" className="hover:underline">
            <h1 className="text-2xl">vovonacci@PJT</h1>
          </Link>
        </div>
        <div className="flex items-center justify-center font-light">
          <p>
            Vovonacci do Porteiro José Traders. Opero daytrade em mercados
            futuros desde 2018, focando em futuros americanos desde 2023.
            <br />
            Aqui compartilho minhas preparações diárias/semanais, revisões de
            pregão, e uns posts aleatórios de vez em nunca. <br /> Sinta-se à
            vontade para explorar e entrar em contato em caso de possuir
            perguntas. <br /> Nosso intuito aqui é puramente educativo, deve-se
            lembrar. <br />
            <br />
            comunique-se com nois{" "}
            <b className="text-orange-400 hover:underline">
              <i>porteirojosetrading@gmail.com</i>
            </b>
            ;
            <br />
            ou no X: <i className="hover:underline">@vovonacci</i>
          </p>
        </div>
        <div className="mt-2 py-2 border-t border-gray-400">
          <ul>
            {posts.map((post) => (
              <li key={post.slug} className="mb-2 ">
                <a
                  href={`/blog/${post.slug}`}
                  className="text-indigo-500 hover:text-cyan-600 text-lg"
                >
                  {post.title}
                </a>{" "}
                <span className="text-gray-400 text-lg">({post.date})</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
