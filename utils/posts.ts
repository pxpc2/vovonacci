import fs from "fs/promises";
import fsSync from "fs"; // still OK for sync dir listing
import path from "path";
import matter from "gray-matter";

export type PostMeta = {
  slug: string;
  title: string;
  date: string;
  tags?: string[];
};

const postsDirectory = path.join(process.cwd(), "posts");

// Synchronous: OK for generateStaticParams
export function getAllPosts(): PostMeta[] {
  const fileNames = fsSync.readdirSync(postsDirectory);

  return fileNames
    .map((fileName) => {
      const slug = fileName.replace(/\.md$/, "");
      const fullPath = path.join(postsDirectory, fileName);
      const fileContents = fsSync.readFileSync(fullPath, "utf8");
      const { data } = matter(fileContents);

      return {
        slug,
        title: data.title,
        date: data.date,
        tags: data.tags || [],
      };
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

// ✅ Async version for use in async components
export async function getPostBySlug(slug: string) {
  try {
    const fullPath = path.join(postsDirectory, `${slug}.md`);
    const fileContents = await fs.readFile(fullPath, "utf8");
    const { data, content } = matter(fileContents);

    return {
      slug,
      title: data.title,
      date: data.date,
      content,
    };
  } catch (error) {
    return null; // triggers notFound() if file doesn't exist
  }
}
