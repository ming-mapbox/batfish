// @flow
import React from 'react';
import PropTypes from 'prop-types';
import linkHijacker from '@mapbox/link-hijacker';
import scrollRestorer from '@mapbox/scroll-restorer';
import linkToLocation from '@mapbox/link-to-location';
import querySelectorContainsNode from '@mapbox/query-selector-contains-node';
import { batfishContext } from 'batfish-internal/context';
import { routeTo } from '@mapbox/batfish/modules/route-to';
import { prefixUrl } from '@mapbox/batfish/modules/prefix-url';
import { findMatchingRoute } from './find-matching-route';
import { scrollToFragment } from './scroll-to-fragment';
import {
  _invokeRouteChangeStartCallbacks,
  _invokeRouteChangeEndCallbacks
} from '@mapbox/batfish/modules/route-change-listeners';

prefixUrl._configure(
  batfishContext.selectedConfig.siteBasePath,
  batfishContext.selectedConfig.siteOrigin
);

function getContextLocation(): BatfishLocation {
  let tidyPath = window.location.pathname;
  if (!/\/$/.test(tidyPath)) tidyPath += '/';
  return {
    pathname: tidyPath,
    hash: window.location.hash,
    search: window.location.search
  };
}

type Props = {
  startingPath: string,
  startingComponent: React$ComponentType<*>,
  startingProps: Object
};

type State = {
  path: string,
  PageComponent: React$ComponentType<*>,
  pageProps: Object,
  location: BatfishLocation
};

class Router extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    const location: BatfishLocation = {
      pathname: this.props.startingPath
    };
    if (typeof window !== 'undefined') {
      location.search = window.location.search;
      location.hash = window.location.hash;
    }
    this.state = {
      path: this.props.startingPath,
      PageComponent: this.props.startingComponent,
      pageProps: this.props.startingProps,
      location
    };
  }

  getChildContext() {
    return { location: this.state.location };
  }

  componentDidMount() {
    scrollRestorer.start({ autoRestore: false });
    scrollRestorer.restoreScroll();

    // Only on the dev server do we need to scroll to fragments on the initial
    // load. With static HTML pages, the browser should take care of this
    // for us.
    if (process.env.DEV_SERVER) {
      scrollToFragment();
    }

    routeTo._onRouteTo(this.routeTo);
    window.addEventListener('popstate', event => {
      event.preventDefault();
      this.changePage({
        pathname: document.location.pathname,
        search: document.location.search,
        hash: document.location.hash
      });
    });

    if (batfishContext.selectedConfig.hijackLinks) {
      linkHijacker.hijack(
        {
          skipFilter: link =>
            querySelectorContainsNode('[data-batfish-no-hijack]', link)
        },
        this.routeTo
      );
    }

    this.setState({
      location: getContextLocation()
    });
  }

  // Converts input to a location object.
  // If it matches a route, go there dynamically and scroll to the top of the viewport.
  // If it doesn't match a route, go there non-dynamically.
  routeTo = (input: string | HTMLAnchorElement) => {
    const targetLocation: BatfishLocation = linkToLocation(input);
    if (findMatchingRoute(targetLocation.pathname).is404) {
      return window.location.assign(input);
    }
    this.changePage(targetLocation, {
      pushState: true,
      scrollToTop:
        window.location.pathname !== targetLocation.pathname ||
        !targetLocation.hash
    });
  };

  // To change the page, we need to
  // - Get the matching page module, which is an async Webpack bundle.
  // - Use pushState to change the URL and add a new history entry.
  // - Change the state of this component to render the new page.
  // - Adjust scroll position on the new page.
  changePage = (
    nextLocation: BatfishLocation,
    options: Object = {},
    callback?: () => mixed
  ) => {
    const matchingRoute = findMatchingRoute(nextLocation.pathname);
    const nextUrl = [
      nextLocation.pathname,
      nextLocation.hash,
      nextLocation.search
    ].join('');
    const startChange = _invokeRouteChangeStartCallbacks(nextLocation.pathname);
    matchingRoute
      .getPage()
      .then(pageModule => {
        return startChange.then(() => pageModule);
      })
      .then(pageModule => {
        if (options.pushState) {
          window.history.pushState({}, null, nextUrl);
        }
        const nextState = {
          path: matchingRoute.path,
          PageComponent: pageModule.component,
          pageProps: pageModule.props,
          location: getContextLocation()
        };
        this.setState(nextState, () => {
          if (options.scrollToTop) {
            window.scrollTo(0, 0);
          } else if (scrollRestorer.getSavedScroll()) {
            scrollRestorer.restoreScroll();
          } else {
            scrollToFragment();
          }
          if (callback) callback();
          _invokeRouteChangeEndCallbacks(nextLocation.pathname);
        });
      });
  };

  render() {
    const { PageComponent } = this.state;
    if (!PageComponent) return null;

    return (
      <PageComponent location={this.state.location} {...this.state.pageProps} />
    );
  }
}

Router.childContextTypes = {
  location: PropTypes.shape({
    pathname: PropTypes.string.isRequired,
    hash: PropTypes.string,
    search: PropTypes.string
  }).isRequired
};

export { Router };