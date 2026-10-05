import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageHeroComponent } from '../../components/page-hero/page-hero.component';
import { BipRigComponent } from '../../components/bip-rig/bip-rig.component';
import { CtaBandComponent } from '../../components/cta-band/cta-band.component';
import { RevealDirective } from '../../shared/reveal.directive';
import { TiltDirective } from '../../shared/tilt.directive';
import { BLOG_POSTS, BlogPost } from '../../data/blog.data';

@Component({
  selector: 'app-blog',
  standalone: true,
  imports: [RouterLink, PageHeroComponent, BipRigComponent, CtaBandComponent, RevealDirective, TiltDirective],
  templateUrl: './blog.component.html',
  styleUrl: './blog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlogComponent {
  readonly categories = ['Todos', ...new Set(BLOG_POSTS.map((p) => p.category))];
  selected = 'Todos';

  get featured(): BlogPost {
    return BLOG_POSTS[0];
  }

  get posts(): BlogPost[] {
    const rest = BLOG_POSTS.slice(1);
    return this.selected === 'Todos' ? rest : BLOG_POSTS.filter((p) => p.category === this.selected);
  }
}
