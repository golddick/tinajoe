import { and, asc, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { galleryCategories, galleryItems } from '@/lib/db/schema'

export async function getGalleryContent() {
  const [categories, items] = await Promise.all([
    db
      .select({
        id: galleryCategories.id,
        name: galleryCategories.name,
      })
      .from(galleryCategories)
      .where(eq(galleryCategories.active, true))
      .orderBy(asc(galleryCategories.name)),
    db
      .select({
        id: galleryItems.id,
        title: galleryItems.title,
        categoryId: galleryItems.categoryId,
        category: galleryCategories.name,
        imageId: galleryItems.imageId,
        image: galleryItems.imageUrl,
      })
      .from(galleryItems)
      .innerJoin(
        galleryCategories,
        eq(galleryItems.categoryId, galleryCategories.id),
      )
      .where(
        and(
          eq(galleryItems.active, true),
          eq(galleryCategories.active, true),
        ),
      )
      .orderBy(desc(galleryItems.createdAt)),
  ])
  return { categories, items }
}
