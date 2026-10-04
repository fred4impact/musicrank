MusicRank — Project Specification
1. Project Overview
MusicRank is a containerized, event-driven music ranking platform inspired by the architecture of a distributed voting application.
Users can browse songs and submit ratings/votes. Votes are accepted by an API, placed into Redis for asynchronous processing, consumed by worker services, and persisted in PostgreSQL. A ranking API exposes aggregated results to a web dashboard.
The primary purpose of the project is to build a realistic application while demonstrating:
- Microservice architecture
- REST APIs
- Asynchronous event processing
- Redis as a queue/cache
- PostgreSQL persistence
- Docker containerization
- Kubernetes deployments and services
- Horizontal scaling
- Health checks
- Persistent storage
- CI/CD
- Observability
The application should be designed so that the business functionality is useful, but the infrastructure and deployment architecture are equally important.
2. Goals
Primary goals
1. Build a working music rating/ranking application.
2. Separate application functionality into independently deployable services.
3. Process votes asynchronously using Redis and workers.
4. Store authoritative data in PostgreSQL.
5. Containerize every application component.
6. Deploy the system to Kubernetes.
7. Demonstrate scaling and self-healing.
8. Automate testing and container builds with CI/CD.
9. Provide monitoring and operational documentation.
10. Produce a portfolio-quality GitHub repository.
Non-goals for the first release
The initial version will NOT attempt to:
- Stream full songs.
- Host copyrighted music files.
- Recreate Spotify.
- Build a recommendation engine.
- Implement social networking.
- Provide complex machine-learning functionality.
- Support payments or subscriptions.
3. Proposed Technology Stack
Frontend
Recommended:
- React
- TypeScript
- Vite
- CSS/Tailwind CSS
Responsibilities:
- Display songs
- Submit ratings
- Display rankings
- Display song statistics
- Display categories/genres
- Provide responsive UI
Vote API
Recommended:
- Node.js
- TypeScript
- Express or Fastify
Responsibilities:
- Receive votes
- Validate requests
- Prevent obviously invalid ratings
- Publish vote events to Redis
- Return request status
Ranking API
Recommended:
- Node.js
- TypeScript
- Express or Fastify
Responsibilities:
- Retrieve rankings
- Retrieve song statistics
- Retrieve trending songs
- Provide dashboard data
Worker
Recommended:
- Node.js
- TypeScript
Responsibilities:
- Consume vote events from Redis
- Validate/process events
- Update PostgreSQL
- Update ranking aggregates
- Handle failures safely
Message Queue / Cache
- Redis
Responsibilities:
- Temporary vote queue
- Optional caching of ranking results
- Decoupling API requests from database processing
Database
- PostgreSQL
Responsibilities:
- Users
- Songs
- Artists
- Genres
- Votes
- Ranking aggregates
- Historical statistics
Containers
- Docker
- Docker Compose for local development
Orchestration
- Kubernetes
Recommended development environments:
- Minikube
- Kind
- Docker Desktop Kubernetes
Production-style deployment can later target a managed Kubernetes service.
CI/CD
Recommended:
- GitHub Actions
- GitHub Container Registry (GHCR)
Monitoring
Optional initially, recommended for the final version:
- Prometheus
- Grafana
4. High-Level Architecture
                         Internet
                            |
                            v
                    +----------------+
                    |    Frontend    |
                    | React / Vite   |
                    +-------+--------+
                            |
                            v
                    +----------------+
                    |    Vote API     |
                    +-------+--------+
                            |
                            v
                    +----------------+
                    |     Redis       |
                    | Vote Queue      |
                    +-------+--------+
                            |
                            v
                    +----------------+
                    |     Worker      |
                    +-------+--------+
                            |
                            v
                    +----------------+
                    |   PostgreSQL    |
                    +-------+--------+
                            ^
                            |
                    +-------+--------+
                    |   Ranking API   |
                    +-------+--------+
                            ^
                            |
                    +-------+--------+
                    |    Frontend    |
                    | Ranking Pages  |
                    +----------------+
5. Core Services
5.1 Frontend Service
Purpose
Provides the user interface for MusicRank.
Main pages
Home
Displays:
- Featured songs
- Trending songs
- Top-ranked songs
- Genre navigation
Song List
Displays:
- Song title
- Artist
- Album
- Genre
- Rating
- Vote count
Song Details
Displays:
- Song information
- Current rating
- Vote count
- Rating history
- Ranking position
Rankings
Displays:
- Global ranking
- Genre rankings
- Weekly ranking
- Monthly ranking
- Trending ranking
Admin/Analytics
Optional:
- Total votes
- Total songs
- Active users
- Votes over time
- Top artists
- Top genres
6. Vote API
Example endpoint
POST /api/v1/votes
Example request:
{
  "songId": 123,
  "rating": 5
}
Example response:
{
  "message": "Vote accepted",
  "voteId": "vote-abc123",
  "status": "queued"
}
The API should not directly perform expensive ranking calculations.
Instead:
HTTP Request
     |
     v
Validate
     |
     v
Create Event
     |
     v
Redis
     |
     v
Return response
This keeps the API responsive and allows processing to scale independently.
7. Vote Event
A vote placed into Redis should contain enough information for the worker to process it.
Example:
{
  "eventId": "evt-12345",
  "userId": 1001,
  "songId": 123,
  "rating": 5,
  "timestamp": "2026-10-04T20:00:00Z"
}
Recommended fields:
- eventId
- userId
- songId
- rating
- timestamp
The event ID should be unique so that duplicate processing can be detected.
8. Worker Service
The worker consumes vote events from Redis.
Processing flow:
Redis
  |
  v
Worker receives event
  |
  v
Validate event
  |
  v
Check duplicate
  |
  v
Insert vote
  |
  v
Update song statistics
  |
  v
Commit transaction
The worker should be designed to handle failures.
If database processing fails:
Vote Event
    |
    v
Worker
    |
    X
Database Failure
    |
    v
Retry / Requeue
The exact retry strategy can be implemented in a later version.
9. Ranking API
Suggested endpoints
GET /api/v1/rankings
GET /api/v1/rankings/global
GET /api/v1/rankings/trending
GET /api/v1/rankings/weekly
GET /api/v1/rankings/monthly

GET /api/v1/songs
GET /api/v1/songs/:id
GET /api/v1/artists/:id
GET /api/v1/genres
Example:
GET /api/v1/rankings/global?limit=10
Response:
{
  "ranking": [
    {
      "position": 1,
      "songId": 123,
      "title": "Example Song",
      "artist": "Example Artist",
      "score": 4.82,
      "votes": 12421
    }
  ]
}
10. Database Design
PostgreSQL should be the source of truth for permanent application data.
Main entities
users
songs
artists
genres
votes
song_statistics
Suggested relationships
Artist
  |
  +---- Songs
          |
          +---- Genre
          |
          +---- Votes
          |
          +---- Statistics
Users
Suggested fields:
id
username
email
created_at
Artists
Suggested fields:
id
name
created_at
Genres
Suggested fields:
id
name
Songs
Suggested fields:
id
title
artist_id
genre_id
album
release_date
duration_seconds
cover_image_url
created_at
Votes
Suggested fields:
id
event_id
user_id
song_id
rating
created_at
Song Statistics
Suggested fields:
song_id
vote_count
average_rating
ranking_score
updated_at
11. Rating System
Users should initially rate songs from 1 to 5.
1 = Very poor
2 = Poor
3 = Average
4 = Good
5 = Excellent
Validation:
rating >= 1
rating <= 5
The database should also enforce valid values where appropriate.
12. Ranking Algorithm
Version 1
Start with a simple average:
average_rating =
    total_rating_points / total_votes
Example:
5 + 5 + 4 + 5 + 4 = 23

23 / 5 = 4.6
Version 2
Introduce vote-count weighting.
A simple project-friendly formula could be:
ranking_score =
    average_rating * 0.7
    + popularity_score * 0.2
    + trending_score * 0.1
The exact implementation can evolve.
Important requirement
A song with only one vote should not automatically dominate a song with thousands of votes.
A more advanced version can use Bayesian ranking.
13. Trending Algorithm
Trending songs can be based on recent activity.
Example concept:
trending_score =
    recent_votes * recency_weight
    + recent_rating_average
The first implementation can simply use:
number of votes during the last 24 hours
Later versions can introduce time decay.
14. Redis Design
Redis can be used for:
1. Vote queue
2. Temporary ranking cache
Example queue:
music:votes
Example cache:
ranking:global
ranking:trending
ranking:genre:rock
ranking:genre:pop
Important:
Redis should not be considered the permanent source of truth.
PostgreSQL remains authoritative.
15. Docker Architecture
Every independently deployable service should have its own Docker image.
frontend
vote-api
ranking-api
worker
Infrastructure containers:
redis
postgres
Local development should support:
docker compose up
The full application should start without requiring Kubernetes.
16. Docker Compose
Local architecture:
Docker Compose
|
+-- frontend
|
+-- vote-api
|
+-- ranking-api
|
+-- worker
|
+-- redis
|
+-- postgres
Docker Compose is intended for local development and integration testing.
Kubernetes is the target orchestration platform.
17. Kubernetes Architecture
Recommended namespace:
musicrank
Resources:
Namespace
|
+-- frontend Deployment
|      |
|      +-- Pod
|      +-- Pod
|      +-- Pod
|
+-- frontend Service
|
+-- vote-api Deployment
|      |
|      +-- Pod
|      +-- Pod
|      +-- Pod
|
+-- vote-api Service
|
+-- ranking-api Deployment
|      |
|      +-- Pod
|      +-- Pod
|
+-- ranking-api Service
|
+-- worker Deployment
|      |
|      +-- Pod
|      +-- Pod
|
+-- redis Deployment
|
+-- redis Service
|
+-- postgres StatefulSet
|
+-- postgres Service
|
+-- PersistentVolumeClaim
18. Kubernetes Services
Frontend
Can be exposed externally.
Vote API
Can be exposed through the frontend/Ingress.
Ranking API
Can be internal or exposed through the Ingress.
Redis
Cluster-internal only.
PostgreSQL
Cluster-internal only.
19. Kubernetes Configuration
Use ConfigMaps for non-sensitive configuration.
Example:
DATABASE_HOST=postgres
DATABASE_NAME=musicrank
REDIS_HOST=redis
Use Secrets for sensitive information.
Example:
DATABASE_USER
DATABASE_PASSWORD
Do not commit real credentials to Git.
20. Health Checks
Each API should provide:
GET /health
Example:
{
  "status": "ok"
}
Optionally provide:
GET /ready
Kubernetes should use:
- Liveness probes
- Readiness probes
This allows Kubernetes to distinguish between a crashed container and a temporarily unavailable dependency.
21. Resource Management
Production-style Kubernetes manifests should define:
CPU requests
CPU limits
Memory requests
Memory limits
Example concept:
resources:
  requests:
    cpu: "100m"
    memory: "128Mi"
  limits:
    cpu: "500m"
    memory: "512Mi"
Exact values should be tuned after observing the application.
22. Scaling
The Vote API should be horizontally scalable.
Initial deployment:
vote-api
replicas: 2
Later:
vote-api
replicas: 3
Advanced version:
Horizontal Pod Autoscaler
The goal is to demonstrate that multiple API instances can process incoming traffic.
The worker can also be scaled independently.
23. Persistent Storage
PostgreSQL requires persistent storage.
Do not rely on container filesystem storage for production-style Kubernetes deployment.
Use:
PostgreSQL
   |
   v
PersistentVolumeClaim
   |
   v
PersistentVolume
If the PostgreSQL Pod is recreated, application data should remain available.
For a serious production deployment, use a managed PostgreSQL service or a properly operated database solution rather than treating a single PostgreSQL Pod as highly available.
24. Security Requirements
Minimum requirements:
- Do not store passwords in Git.
- Use Kubernetes Secrets.
- Validate API input.
- Validate rating range.
- Use parameterized SQL.
- Restrict database access to internal services.
- Restrict Redis access to internal services.
- Use HTTPS in production.
- Avoid exposing unnecessary Kubernetes services.
- Run containers as non-root users where practical.
Advanced:
- Authentication
- Authorization
- Rate limiting
- NetworkPolicies
- API security headers
25. Authentication
Authentication is optional for Version 1.
Version 2 can introduce:
Register
Login
Logout
Possible approach:
- JWT
- Secure HTTP-only cookies
A user should eventually have:
user_id
associated with each vote.
This enables features such as:
- Voting history
- One vote per song
- Changing a rating
- User statistics
26. Voting Rules
Choose one model and document it.
Recommended first version:
A user may submit one rating per song.

Database constraint:
UNIQUE(user_id, song_id)
If the user changes their rating later, the existing vote can be updated.
This avoids unlimited voting abuse.
27. API Error Handling
The APIs should return consistent errors.
Example:
{
  "error": {
    "code": "SONG_NOT_FOUND",
    "message": "The requested song does not exist."
  }
}
Suggested HTTP codes:
200 OK
201 Created
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
429 Too Many Requests
500 Internal Server Error
28. Observability
The final project should provide visibility into system behaviour.
Minimum:
- Structured application logs
- Request logging
- Worker processing logs
- Error logging
Advanced:
Prometheus
    |
    v
Metrics
    |
    v
Grafana
Useful metrics:
HTTP requests
HTTP errors
Request latency
Votes received
Votes processed
Votes failed
Redis queue size
Worker processing time
Database connections
CPU usage
Memory usage
Pod restarts
29. CI/CD
GitHub Actions should eventually automate:
Git push
   |
   v
Run tests
   |
   v
Build applications
   |
   v
Build Docker images
   |
   v
Push images to GHCR
   |
   v
Deploy to Kubernetes
Suggested workflow stages:
1. Lint
2. Unit tests
3. Build
4. Docker image build
5. Container image push
6. Deployment
For an initial implementation, deployment can remain manual.
30. Testing Strategy
Unit tests
Test:
- Rating validation
- Ranking calculations
- Trending calculations
- API validation
- Worker processing
Integration tests
Test:
Vote API
   ↓
Redis
   ↓
Worker
   ↓
PostgreSQL
End-to-end tests
Test:
Browser
   ↓
Frontend
   ↓
API
   ↓
Redis
   ↓
Worker
   ↓
Database
   ↓
Ranking
31. Sample User Flow
1. User opens MusicRank.

2. Frontend requests:
   GET /api/v1/rankings/global

3. Ranking API retrieves ranking data.

4. User selects a song.

5. User gives the song 5 stars.

6. Frontend sends:
   POST /api/v1/votes

7. Vote API validates the request.

8. Vote API publishes an event to Redis.

9. Vote API responds:
   "Vote accepted."

10. Worker receives the event.

11. Worker writes the vote to PostgreSQL.

12. Worker updates song statistics.

13. User refreshes the ranking.

14. Ranking API returns updated data.
32. Example Repository Structure
music-rank/
│
├── frontend/
│   ├── src/
│   ├── public/
│   ├── Dockerfile
│   ├── package.json
│   └── README.md
│
├── vote-api/
│   ├── src/
│   ├── tests/
│   ├── Dockerfile
│   ├── package.json
│   └── README.md
│
├── ranking-api/
│   ├── src/
│   ├── tests/
│   ├── Dockerfile
│   ├── package.json
│   └── README.md
│
├── worker/
│   ├── src/
│   ├── tests/
│   ├── Dockerfile
│   ├── package.json
│   └── README.md
│
├── database/
│   ├── migrations/
│   └── seed/
│
├── docker/
│
├── kubernetes/
│   ├── namespace.yaml
│   ├── configmap.yaml
│   ├── secrets.example.yaml
│   │
│   ├── frontend/
│   ├── vote-api/
│   ├── ranking-api/
│   ├── worker/
│   ├── redis/
│   └── postgres/
│
├── monitoring/
│   ├── prometheus/
│   └── grafana/
│
├── .github/
│   └── workflows/
│       ├── test.yml
│       └── build.yml
│
├── docker-compose.yml
├── README.md
└── LICENSE
33. Development Phases
Phase 1 — Project foundation
Tasks:
- Create GitHub repository.
- Define services.
- Create project structure.
- Set up frontend.
- Set up API.
- Set up PostgreSQL.
- Create initial database schema.
Deliverable:
A basic application that can display songs from PostgreSQL.

Phase 2 — Voting
Tasks:
- Implement rating UI.
- Implement Vote API.
- Validate ratings.
- Store vote events in Redis.
- Implement worker.
- Store votes in PostgreSQL.
Deliverable:
A user can rate a song and the vote eventually appears in PostgreSQL.

Phase 3 — Rankings
Tasks:
- Calculate average ratings.
- Calculate vote counts.
- Create ranking API.
- Create ranking UI.
- Add sorting.
- Add pagination.
Deliverable:
Users can see the current music rankings.

Phase 4 — Docker
Tasks:
- Create Dockerfiles.
- Build each service.
- Create docker-compose.yml.
- Add health checks.
- Test the complete application locally.
Deliverable:
docker compose up
starts the application.
Phase 5 — Kubernetes
Tasks:
- Create namespace.
- Create Deployments.
- Create Services.
- Configure ConfigMaps.
- Configure Secrets.
- Configure PostgreSQL persistence.
- Add readiness probes.
- Add liveness probes.
Deliverable:
kubectl apply -f kubernetes/
deploys the application.
Phase 6 — Kubernetes scaling
Tasks:
- Increase frontend replicas.
- Increase API replicas.
- Increase worker replicas.
- Test Pod failure.
- Test rolling updates.
- Add resource requests/limits.
- Add HPA.
Deliverable:
The application demonstrates Kubernetes scaling and self-healing.

Phase 7 — CI/CD
Tasks:
- Configure GitHub Actions.
- Run automated tests.
- Build Docker images.
- Push images to GHCR.
- Automate deployment.
Deliverable:
A Git push can trigger an automated build/deployment pipeline.

Phase 8 — Monitoring
Tasks:
- Add application metrics.
- Add Prometheus.
- Add Grafana.
- Create dashboards.
- Monitor worker queue processing.
- Monitor API latency/errors.
Deliverable:
The project has operational visibility.

34. Definition of Done
The project is considered complete when:
Application
- [ ] Users can view songs.
- [ ] Users can rate songs.
- [ ] Ratings are validated.
- [ ] Votes are queued through Redis.
- [ ] Worker processes votes.
- [ ] Votes are stored in PostgreSQL.
- [ ] Rankings are calculated.
- [ ] Ranking pages work.
Docker
- [ ] Every application service has a Dockerfile.
- [ ] Docker Compose runs the complete system.
- [ ] Services communicate correctly.
Kubernetes
- [ ] Application is deployed to Kubernetes.
- [ ] Services are configured correctly.
- [ ] PostgreSQL has persistent storage.
- [ ] ConfigMaps are used where appropriate.
- [ ] Secrets are used for sensitive values.
- [ ] Health checks are configured.
- [ ] Multiple replicas work.
- [ ] Pod recovery has been tested.
CI/CD
- [ ] Tests run automatically.
- [ ] Docker images build automatically.
- [ ] Images are pushed to a registry.
- [ ] Deployment can be automated.
Documentation
- [ ] README is complete.
- [ ] Architecture diagram exists.
- [ ] Local setup is documented.
- [ ] Kubernetes setup is documented.
- [ ] API endpoints are documented.
- [ ] Design decisions are documented.
- [ ] Troubleshooting guide exists.
35. Suggested MVP
Do NOT attempt to build every feature at once.
The first milestone should be:
React Frontend
      |
      v
Vote API
      |
      v
Redis
      |
      v
Worker
      |
      v
PostgreSQL
      |
      v
Ranking API
      |
      v
Ranking UI
The MVP should support:
- A small collection of seeded songs
- 1–5 ratings
- Redis vote queue
- Worker processing
- PostgreSQL persistence
- Global ranking
- Docker Compose
Only after this works should Kubernetes be introduced.
36. Stretch Goals
After the core system is stable:
Application
- Search
- Artist pages
- Album pages
- Genre rankings
- Weekly rankings
- Monthly rankings
- User profiles
- Voting history
- Favourite songs
- Comments
- Song comparison
- Import song metadata
Distributed systems
- Retry queues
- Dead-letter queue
- Idempotent processing
- Event IDs
- Cache invalidation
- Rate limiting
Kubernetes
- Ingress
- TLS
- HPA
- NetworkPolicies
- PodDisruptionBudgets
- Helm
- Stateful workloads
- Secrets management
DevOps
- GitHub Actions
- Container registry
- Automated deployment
- Argo CD / GitOps
- Semantic versioning
Observability
- Prometheus
- Grafana
- Centralized logs
- Distributed tracing
- Alerting
37. Portfolio Presentation
The GitHub README should clearly explain:
Problem
Users need a way to discover and rank popular music based on community ratings.
Solution
MusicRank provides a distributed music ranking platform using asynchronous vote processing.
Architecture
Frontend
   ↓
Vote API
   ↓
Redis
   ↓
Worker
   ↓
PostgreSQL
   ↑
Ranking API
   ↑
Frontend
Infrastructure
Docker
   ↓
Kubernetes
   ↓
CI/CD
   ↓
Monitoring
Key technical concepts demonstrated
- Microservices
- Event-driven architecture
- Asynchronous processing
- REST APIs
- Redis
- PostgreSQL
- Docker
- Kubernetes
- Horizontal scaling
- Persistent storage
- CI/CD
- Observability
38. Recommended First Milestone
Before writing Kubernetes YAML, make this work locally:
Frontend
    |
    v
Vote API
    |
    v
Redis
    |
    v
Worker
    |
    v
PostgreSQL
    |
    v
Ranking API
    |
    v
Frontend
Once this flow works reliably with Docker Compose, move the exact same services into Kubernetes.
This approach prevents Kubernetes configuration problems from hiding application bugs.
39. Final Target
The completed project should demonstrate the following architecture:
                         USERS
                           |
                           v
                    +-------------+
                    |   Ingress   |
                    +------+------+
                           |
                           v
                    +-------------+
                    |  Frontend  |
                    +------+------+
                           |
             +-------------+-------------+
             |                           |
             v                           v
       +-----------+               +-----------+
       |  Vote API |               | Ranking   |
       |  replicas |               |    API    |
       +-----+-----+               +-----+-----+
             |                           |
             v                           |
       +-----------+                     |
       |   Redis   |                     |
       |   Queue   |                     |
       +-----+-----+                     |
             |                           |
             v                           |
       +-----------+                     |
       |  Workers  |                     |
       |  replicas |                     |
       +-----+-----+                     |
             |                           |
             +------------+--------------+
                          |
                          v
                   +-------------+
                   | PostgreSQL  |
                   | Persistent  |
                   |   Storage   |
                   +-------------+

                    Observability
                         |
              +----------+----------+
              |                     |
              v                     v
         Prometheus              Grafana
The final system should be reproducible from the repository and deployable using documented commands.
40. Project Success Criteria
MusicRank is successful if it can demonstrate all of the following:
1. A user submits a rating.
2. The API accepts the rating.
3. Redis queues the event.
4. A worker consumes the event.
5. PostgreSQL stores the vote.
6. Ranking statistics are updated.
7. The frontend displays the updated ranking.
8. All services run as containers.
9. The same system runs on Kubernetes.
10. Kubernetes can restart failed Pods.
11. API services can be scaled horizontally.
12. PostgreSQL data survives Pod recreation through persistent storage.
13. Automated tests run through CI.
14. Docker images can be built and published automatically.
15. Monitoring can show application and infrastructure health.
Final Recommendation
Build the project in this order:
1. Database
      ↓
2. Vote API
      ↓
3. Redis
      ↓
4. Worker
      ↓
5. Ranking API
      ↓
6. Frontend
      ↓
7. Docker Compose
      ↓
8. Kubernetes
      ↓
9. CI/CD
      ↓
10. Monitoring
Do not start with Kubernetes.
Build a reliable application first, containerize it second, and then use Kubernetes to solve deployment, scaling, availability, and operational problems.
This will make the project easier to build, debug, explain, and demonstrate in a portfolio.