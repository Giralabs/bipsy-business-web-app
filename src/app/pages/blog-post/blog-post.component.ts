import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { CtaBandComponent } from '../../components/cta-band/cta-band.component';
import { RevealDirective } from '../../shared/reveal.directive';
import { BLOG_POSTS, BlogPost, postBySlug } from '../../data/blog.data';
import { Feature, featureBySlug } from '../../data/features.data';

@Component({
  selector: 'app-blog-post',
  standalone: true,
  imports: [RouterLink, CtaBandComponent, RevealDirective],
  templateUrl: './blog-post.component.html',
  styleUrl: './blog-post.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlogPostComponent {
  post?: BlogPost;
  feature?: Feature;
  more: BlogPost[] = [];

  constructor(
    private readonly title: Title,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  @Input()
  set slug(value: string) {
    const post = postBySlug(value);
    if (!post) {
      void this.router.navigate(['/blog']);
      return;
    }
    this.post = post;
    this.feature = featureBySlug(post.featureSlug);
    this.more = BLOG_POSTS.filter((p) => p.slug !== post.slug).slice(0, 3);
    this.title.setTitle(`${post.title} · Blog de Bipsy Business`);
    this.cdr.markForCheck();
  }
}
