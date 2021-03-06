/**
 * @license
 * Copyright DagonMetric. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found under the LICENSE file in the root directory of this source tree.
 */

import { isPlatformBrowser } from '@angular/common';
import { Component, Inject, OnDestroy, OnInit, PLATFORM_ID, ViewEncapsulation } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';

import { CacheService } from '@dagonmetric/ng-cache';
import { ConfigService } from '@dagonmetric/ng-config';
import { LogService } from '@dagonmetric/ng-log';

import { Subject } from 'rxjs';
import { filter, map, takeUntil } from 'rxjs/operators';

import { environment } from '../environments/environment';
import { LinkService } from '../modules/seo';

import { PageInfo } from './shared/page-info';
import { UrlHelper } from './shared/url-helper';

/**
 * Core app component.
 */
@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
    encapsulation: ViewEncapsulation.None
})
export class AppComponent implements OnInit, OnDestroy {
    title = '';
    is404 = false;
    isHomePage = false;
    appUsed = false;

    private readonly _pageInfoMap: { [key: string]: PageInfo };
    private readonly _onDestroy = new Subject<void>();
    private readonly _isBrowser: boolean;
    private _isFirstNavigation = true;

    constructor(
        // tslint:disable-next-line: ban-types
        @Inject(PLATFORM_ID) platformId: Object,
        private readonly _configService: ConfigService,
        private readonly _cacheService: CacheService,
        private readonly _logService: LogService,
        private readonly _titleService: Title,
        private readonly _metaService: Meta,
        private readonly _linkService: LinkService,
        private readonly _urlHelper: UrlHelper,
        private readonly _router: Router,
        private readonly _activatedRoute: ActivatedRoute) {
        this._pageInfoMap = this._configService.getValue<{ [key: string]: PageInfo }>('pageInfo');
        this._isBrowser = isPlatformBrowser(platformId);
        this.appUsed = this._cacheService.getItem<string>('appUsed') === 'true';

        this._router.events
            .pipe(
                filter(event => event instanceof NavigationEnd),
                map((event: NavigationEnd) => {
                    let child = this._activatedRoute.firstChild;
                    while (child && child.firstChild) {
                        child = child.firstChild;
                    }

                    if (!child) {
                        return {};
                    }

                    return {
                        pagePath: event.urlAfterRedirects,
                        pageId: child.snapshot.data.pageId
                    };
                }),
                takeUntil(this._onDestroy)
            )
            .subscribe((routeData: { pagePath?: string; pageId?: string }) => {
                if (environment.production && this._isBrowser && this._isFirstNavigation && this.appUsed) {
                    this._isFirstNavigation = false;

                    if (routeData.pagePath === '/zawgyi-unicode-converter') {
                        window.location.href = 'https://myanmartools.org/apps/zawgyi-unicode-converter';
                    } else if (routeData.pagePath === '/zawgyi-unicode-converter-android') {
                        window.location.href = 'https://play.google.com/store/apps/details?id=com.dagonmetric.zawgyiunicodeconverter';
                    } else if (routeData.pagePath === '/unicode-code-point-lookup') {
                        window.location.href = 'https://unicode-code-point-lookup.myanmartools.org';
                    }
                } else {
                    if (this._isFirstNavigation) {
                        this._isFirstNavigation = false;
                    }
                    this._cacheService.setItem('appUsed', 'true');
                }

                if (routeData.pagePath) {
                    this.updateMeta(routeData.pagePath, routeData.pageId);
                }

                // this.resetScrollPosition();

                this._logService.trackPageView({
                    name: this._titleService.getTitle(),
                    uri: !this._isFirstNavigation && routeData.pagePath ? routeData.pagePath : undefined
                });

            });
    }

    ngOnInit(): void {
        // Do nothing
    }

    ngOnDestroy(): void {
        this._onDestroy.next();
        this._onDestroy.complete();
    }

    private updateMeta(pagePath: string, pageId?: string): void {
        pageId = pageId || pagePath;
        const pageInfo = this._pageInfoMap[pageId];

        if (!pageInfo) {
            return;
        }

        this.isHomePage = pageInfo && pageInfo.pageType === 'home';

        if (pageInfo.pageType === '404') {
            this.is404 = true;
            this._metaService.updateTag({
                name: 'robots',
                content: 'noindex'
            });
        } else {
            this.is404 = false;
            this._metaService.removeTag("name='robots'");
        }

        const url = this._urlHelper.toAbsoluteUrl(pagePath);
        this._linkService.updateTag({
            rel: 'canonical',
            href: url
        });
        this._metaService.updateTag({
            property: 'og:url',
            content: url
        });

        this.title = pageInfo.title;
        const pageTitle = pageInfo.pageTitle || pageInfo.title;
        this._titleService.setTitle(pageTitle);

        const socialTitle = pageInfo.socialTitle || pageInfo.title;
        this._metaService.updateTag({
            name: 'twitter:title',
            content: socialTitle
        });
        this._metaService.updateTag({
            property: 'og:title',
            content: socialTitle
        });

        const metaDescription = pageInfo.description;
        this._metaService.updateTag({
            name: 'description',
            content: metaDescription
        });

        const socialDescription = pageInfo.socialDescription || metaDescription;
        this._metaService.updateTag({
            name: 'twitter:description',
            content: socialDescription
        });
        this._metaService.updateTag({
            property: 'og:description',
            content: socialDescription
        });

        const keywords = pageInfo.keywords;
        this._metaService.updateTag({
            name: 'keywords',
            content: keywords
        });

        const socialImageUrl = pageInfo.socialImageUrl || this._configService.getValue<string>('socialImageUrl');
        const socialImageAbsUrl = this._urlHelper.toAbsoluteUrl(socialImageUrl);
        this._metaService.updateTag({
            name: 'twitter:image',
            content: socialImageAbsUrl
        });
        this._metaService.updateTag({
            property: 'og:image',
            content: socialImageAbsUrl
        });
    }

    // private resetScrollPosition(): void {
    //     if (!this._isBrowser || typeof window !== 'object') {
    //         return;
    //     }

    //     window.scrollTo(0, 0);
    // }
}
