import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HeroSectionComponent } from './sections/hero/hero.component';
import { ShowcaseSectionComponent } from './sections/showcase/showcase.component';
import { BentoSectionComponent } from './sections/bento/bento.component';
import { TeamSectionComponent } from './sections/team/team.component';
import { MarketplaceSectionComponent } from './sections/marketplace/marketplace.component';
import { StepsSectionComponent } from './sections/steps/steps.component';
import { TypesSectionComponent } from './sections/types/types.component';
import { QualitySectionComponent } from './sections/quality/quality.component';
import { PlanCardComponent } from '../../components/plan-card/plan-card.component';
import { FaqListComponent } from '../../components/faq-list/faq-list.component';
import { CtaBandComponent } from '../../components/cta-band/cta-band.component';
import { RevealDirective } from '../../shared/reveal.directive';
import { TiltDirective } from '../../shared/tilt.directive';
import { PLANS } from '../../data/plans.data';
import { HOME_FAQ } from '../../data/faq.data';
import { BLOG_POSTS } from '../../data/blog.data';

/**
 * Home page. The order follows the questions of someone who has never heard
 * of Bipsy: what is it, what does it look like, what does it do, what about my
 * team, where do the clients come from, is it hard, is it for me, how much.
 * Each section is its own component so their styles stay small and separate.
 */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    RouterLink,
    HeroSectionComponent,
    ShowcaseSectionComponent,
    BentoSectionComponent,
    TeamSectionComponent,
    MarketplaceSectionComponent,
    StepsSectionComponent,
    TypesSectionComponent,
    QualitySectionComponent,
    PlanCardComponent,
    FaqListComponent,
    CtaBandComponent,
    RevealDirective,
    TiltDirective,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
  readonly plans = PLANS;
  readonly faq = HOME_FAQ;
  readonly posts = BLOG_POSTS.slice(0, 3);
}
