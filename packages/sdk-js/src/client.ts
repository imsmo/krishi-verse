// @krishi-verse/sdk-js · the client facade. Compose once per request context (SSR: a fresh client with the
// request's token; browser: one client reading the in-memory token). Resource clients hang off it.
import { SdkConfig, resolveConfig } from './config';
import { HttpClient, HttpMethod, RequestOptions, Envelope } from './http';
import { ListingsResource } from './resources/listings';
import { CatalogueResource } from './resources/catalogue';
import { TraceabilityResource } from './resources/traceability';
import { AuthResource } from './resources/auth';
import { MediaResource } from './resources/media';
import { PaymentsResource, PayoutsResource } from './resources/payments';
import { KycResource, BankAccountsResource, AddressesResource } from './resources/identity';
import { TenancyResource } from './resources/tenancy';
import { RbacResource, DisputesResource, UsersResource } from './resources/admin';
import { NotificationsResource } from './resources/notifications';
import { OrdersResource } from './resources/orders';
import { ShipmentsResource } from './resources/logistics';
import { ReviewsResource } from './resources/reviews';
import { CartResource, CheckoutResource } from './resources/commerce';
import { OffersResource } from './resources/offers';
import { ConversationsResource, MaskedCallsResource } from './resources/messaging';
import { AuctionsResource } from './resources/auctions';
import { LabourResource } from './resources/labour';
import { AmbassadorsResource } from './resources/ambassadors';
import { CoursesResource, EnrollmentsResource, ResourcesResource } from './resources/education';
import { MarketResource, WeatherResource } from './resources/market';
import { AssistantResource } from './resources/assistant';
import { SchemesResource } from './resources/schemes';

export class KrishiVerseClient {
  private readonly http: HttpClient;
  readonly listings: ListingsResource;
  readonly catalogue: CatalogueResource;
  readonly traceability: TraceabilityResource;
  readonly auth: AuthResource;
  readonly media: MediaResource;
  readonly payments: PaymentsResource;
  readonly payouts: PayoutsResource;
  readonly kyc: KycResource;
  readonly bankAccounts: BankAccountsResource;
  readonly notifications: NotificationsResource;
  readonly orders: OrdersResource;
  readonly shipments: ShipmentsResource;
  readonly reviews: ReviewsResource;
  readonly addresses: AddressesResource;
  readonly cart: CartResource;
  readonly checkout: CheckoutResource;
  readonly offers: OffersResource;
  readonly conversations: ConversationsResource;
  readonly maskedCalls: MaskedCallsResource;
  readonly auctions: AuctionsResource;
  readonly labour: LabourResource;
  readonly ambassadors: AmbassadorsResource;
  readonly courses: CoursesResource;
  readonly enrollments: EnrollmentsResource;
  readonly tenancy: TenancyResource;
  readonly rbac: RbacResource;
  readonly disputes: DisputesResource;
  readonly users: UsersResource;
  readonly market: MarketResource;
  readonly weather: WeatherResource;
  readonly resources: ResourcesResource;
  readonly assistant: AssistantResource;
  readonly schemes: SchemesResource;

  constructor(config: SdkConfig) {
    this.http = new HttpClient(resolveConfig(config));
    this.listings = new ListingsResource(this.http);
    this.catalogue = new CatalogueResource(this.http);
    this.traceability = new TraceabilityResource(this.http);
    this.auth = new AuthResource(this.http);
    this.media = new MediaResource(this.http);
    this.payments = new PaymentsResource(this.http);
    this.payouts = new PayoutsResource(this.http);
    this.kyc = new KycResource(this.http);
    this.bankAccounts = new BankAccountsResource(this.http);
    this.notifications = new NotificationsResource(this.http);
    this.orders = new OrdersResource(this.http);
    this.shipments = new ShipmentsResource(this.http);
    this.reviews = new ReviewsResource(this.http);
    this.addresses = new AddressesResource(this.http);
    this.cart = new CartResource(this.http);
    this.checkout = new CheckoutResource(this.http);
    this.offers = new OffersResource(this.http);
    this.conversations = new ConversationsResource(this.http);
    this.maskedCalls = new MaskedCallsResource(this.http);
    this.auctions = new AuctionsResource(this.http);
    this.labour = new LabourResource(this.http);
    this.ambassadors = new AmbassadorsResource(this.http);
    this.courses = new CoursesResource(this.http);
    this.enrollments = new EnrollmentsResource(this.http);
    this.tenancy = new TenancyResource(this.http);
    this.rbac = new RbacResource(this.http);
    this.disputes = new DisputesResource(this.http);
    this.users = new UsersResource(this.http);
    this.market = new MarketResource(this.http);
    this.weather = new WeatherResource(this.http);
    this.resources = new ResourcesResource(this.http);
    this.assistant = new AssistantResource(this.http);
    this.schemes = new SchemesResource(this.http);
  }
  /** Escape hatch for endpoints without a dedicated resource method yet. Same envelope + resilience. */
  request<T>(method: HttpMethod, path: string, opts?: RequestOptions): Promise<Envelope<T>> {
    return this.http.request<T>(method, path, opts);
  }
}
export function createClient(config: SdkConfig): KrishiVerseClient { return new KrishiVerseClient(config); }
