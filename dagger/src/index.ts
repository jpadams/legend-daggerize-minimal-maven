/**
 * Daggerized minimal Legend config
 */

import {
    dag,
    Container,
    Directory,
	File,
    Secret,
    Service,
    object,
    field,
    func,
} from "@dagger.io/dagger"

@object()
class legendDaggerizeMinimalMaven {
    /**
     * Minimal Legend Engine, Studio, and SDLC using gitlab.com
     */
    @func()
    minimal(appId: Secret, appSecret: Secret, useCachedContainer:boolean=true): Service {
        const engine = this.legendEngine(useCachedContainer ? null : dag.git("https://github.com/finos/legend-engine", {keepGitDir: true}).branch("master").tree(), useCachedContainer)
        const sdlc = this.legendSdlc(dag.git("https://github.com/finos/legend-sdlc").branch("master").tree(), null, "gitlab.com", "localhost", appId, appSecret)
        const studio = this.legendStudio(dag.git("https://github.com/finos/legend-studio").branch("master").tree())
        //const depot = this.legendDepot(dag.git("https://github.com/finos/legend-depot").branch("master").tree())

        return dag.proxy()
        .withService(engine.asService(), "engine", 6300, 6300)
        .withService(sdlc.asService(), "sdlc", 6100, 6100)
        .withService(sdlc.asService(), "sdlc-admin", 6101, 6101)
        .withService(studio.asService(), "studio", 9000, 9000)
        .service()
    }

    /**
     * Legend Engine build
     */
    @func()
    engineBase(source?: Directory, useCachedContainer: boolean=false): Container {
        const ubuntuImage = "ubuntu:jammy-20240530"
        // cache of this portion of the build since it takes several hours on my machine
        //const cachedImage = "docker.io/jeremyatdockerhub/legend-engine-poc:latest@sha256:5f2c8256faf99174998c5719c8cd35fa5c8abcbff5022efd9f3162fa56a4cae3"
        const cachedImage = "docker.io/jeremyatdockerhub/legend-engine-poc:latest@sha256:0885578d39ee42a5c863a6fbbe10b2de99d0ae710f6fbefa98a28446917b84a7"

        if (useCachedContainer === true) {
            return dag.container().from(cachedImage)
        }
        else if (source === undefined) {
            throw new Error("if `use-cached-container` is `false` then must provide `source`.")
        }
        else {
            // needs 8GB of heap to build locally
            return this.mavenBuild(source, 8, 11)
       }
    }

    /**
     * Legend Engine ready to run on localhost:6300
     */
    @func()
    legendEngine(source?: Directory, useCachedContainer: boolean=false, configJson?: File): Container {        
        let ctr = this.engineBase(source, useCachedContainer)
        const cfgPath = "./config.json"
        if (configJson) {
            ctr = ctr.withFile(cfgPath, configJson)
        }
        else {
            ctr = ctr.withNewFile(cfgPath, { contents: this.engineConfigJson })
        }
        return ctr
        .withExec([
            "bash",
            "-c",
            `java -cp \
            legend-engine-config/legend-engine-server/legend-engine-server-http-server/target/legend-engine-server-http-server-*-shaded.jar \
            org.finos.legend.engine.server.Server \
            server \
            ${cfgPath}`
        ])
        .withExposedPort(6300)
    }

    /** 
     * Legend SDLC build
     */
    @func()
    sdlcBase(source: Directory): Container {
        return this.mavenBuild(source, 2, 11)
    }

    /**
     * Legend SDLC ready to run on localhost:6100, admin 6101
     */
    @func()
    legendSdlc(
        source: Directory,
        configYaml?: Secret,
        gitlabHost: string="gitlab.com",
        sdlcServerHost: string="localhost:6100",
        appId?: Secret,
        appSecret?: Secret,
    ): Container {
        let ctr = this.sdlcBase(source)
        const cfgPath = "./config.yaml"
        ctr = ctr
        .withEnvVariable("GITLAB_HOST", gitlabHost)
        .withEnvVariable("SDLC_SERVER_HOST", sdlcServerHost)
        .withSecretVariable("APP_ID", appId)
        .withSecretVariable("APP_SECRET", appSecret)
        if (configYaml) {
            ctr = ctr.withMountedSecret(cfgPath, configYaml)
        }
        else {
            ctr = ctr
            // should this whole file be a Secret?
            .withNewFile(`${cfgPath}.template`, { contents: this.sdlcConfigYaml })
            .withExec(["bash", "-c", `envsubst < ${cfgPath}.template > ${cfgPath} && rm ${cfgPath}.template`])
        }
        return ctr
        .withExec([
            "bash",
            "-c",
            `java -cp \
            legend-sdlc-server/target/legend-sdlc-server-*-shaded.jar \
            org.finos.legend.sdlc.server.LegendSDLCServer \
            server \
            ${cfgPath}`
        ])
        .withExposedPort(6100)
        // admin port
        .withExposedPort(6101)
    }

    /**
     * Legend Studio build
     */
    @func()
    studioBase(source: Directory): Container {
        return dag
        .container()
        .from("node:20.15.0")
        .withDirectory("/src", source)
        .withWorkdir("/src")
        .withMountedCache("/src/node_modules", dag.cacheVolume("node-modules"))
        .withMountedCache("/usr/local/share/.cache/yarn", dag.cacheVolume("global-yarn-cache"))
        .withExec(["yarn", "install"])
        .withExec(["yarn", "setup"])
        .withExec(["bash", "-c", "sed -i 's/localhost/0.0.0.0/' packages/legend-application-studio-deployment/studio.config.js"])
    }

    /**
     * Legend Studio ready to run on localhost:9000
     */ 
	@func()
    legendStudio(source: Directory): Container {
        return this.studioBase(source)
        .withExposedPort(9000)
        .withExec(["yarn", "dev"])
    }

    /** 
     * Legend Depot build
     */
    @func()
    depotBase(source: Directory): Container {
        return this.mavenBuild(source, 2, 11)
    }

	/**
     * Legend Depot ready to run on localhost:6200, 6201 admin
     */ 
	@func()
	legendDepot(source: Directory, config: Secret): Container {
	//legendDepot(source: Directory, config: File): Container {
        return this.depotBase(source)
        .withMountedSecret("/src/config.json", config)
        //.withFile("/src/config.json", config)
        // .withExec([
        //     "bash",
        //     "-c",
        //     `java -cp \     
        //     /src/legend-depot-store-server/target/legend-depot-store-server-*-shaded.jar \
        //     org.finos.legend.depot.store.server.LegendDepotStoreServer \
        //     server \
        //     /src/config.json`
        // ])
        .withServiceBinding("mongo", dag.container().from("mongo").asService())
        .withExposedPort(6200)
        .withExposedPort(6201)
	}   

    /**
     * Maven build
     */
    @func()
    mavenBuild(source: Directory, heapGBs: number, jdkVer: number): Container {
        const ubuntuImage = "ubuntu:jammy-20240530"

        return dag
        .container()//{platform: "linux/amd64" as Platform})
        .from(ubuntuImage)
        .withExec([
            "apt",
            "update",
        ])
        .withExec([
            "apt",
            "install",
            `openjdk-${jdkVer}-jdk`,
            "maven",
            "curl",
            "gettext-base",
            "-y",
        ])
        // maven deps cache
        // did not seem worth it to cache target dirs as build often broke
        .withMountedCache(
            "/root/.m2/repository",
            dag.cacheVolume("legend-mvn-cache")
        )
        // copy in source - not mounted so we can publish all to registry
        .withDirectory("/src", source)
        .withEnvVariable("MAVEN_OPTS", `-Xmx${heapGBs}g`)
        .withWorkdir("/src")
        .withExec(["mvn", "install", "-DskipTests"])
    }

    @field()
    engineConfigJson: string

    @field()
    sdlcConfigYaml: string

    @field()
    studioConfigJs: string

    @field()
    depotConfigJson: string

    constructor() {
        this.engineConfigJson = 
`{
    "deployment": {
        "mode": "TEST_IGNORE_FUNCTION_MATCH"
    },
    "logging": {
        "level": "INFO",
        "appenders": [
        {
            "type": "console",
            "logFormat": "%msg\\r\\n"
        }
        ]
    },
    "pac4j": {
        "bypassPaths": ["/api/server/v1/info"],
        "clients": [
        {
            "org.pac4j.core.client.direct.AnonymousClient": {}
        }
        ],
        "mongoSession": {
        "enabled": false
        }
    },
    "opentracing": {
        "elastic": "",
        "zipkin": "",
        "uri": "",
        "authenticator": {
        "principal": "",
        "keytab": ""
        }
    },
    "swagger": {
        "title": "Legend Engine",
        "resourcePackage": "org.finos.legend",
        "uriPrefix": "/api"
    },
    "sessionCookie": "LEGEND_ENGINE_JSESSIONID",
    "server": {
        "type": "simple",
        "applicationContextPath": "/",
        "adminContextPath": "/admin",
        "connector": {
        "maxRequestHeaderSize": "32KiB",
        "type": "http",
        "port": 6300
        },
        "requestLog": {
        "appenders": []
        }
    },
    "metadataserver": {
        "pure": {
        "host": "127.0.0.1",
        "port": 8090
        },
        "alloy": {
        "host": "127.0.0.1",
        "port": 8090,
        "prefix": "/depot/api"
        }
    },
    "temporarytestdb": {
        "port": 9092
    },
    "relationalexecution": {
        "tempPath": "/tmp/"
    }
}
`

    this.sdlcConfigYaml =
`# Copyright 2020 Goldman Sachs
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

applicationName: Legend SDLC

sessionCookie: LEGEND_SDLC_JSESSIONID

server:
  applicationConnectors:
    - type: http
      port: 6100
      maxRequestHeaderSize: 128KiB
  adminConnectors:
    - type: http
      port: 6101
  gzip:
    includedMethods:
      - GET
      - POST
  requestLog:
    type: classic
    appenders:
      - type: file
        currentLogFilename: ./logs/access.log
        threshold: ALL
        archive: true
        archivedLogFilenamePattern: ./logs/access-%d.log
        archivedFileCount: 5
        timeZone: UTC
  rootPath: /api

#features:
#  canCreateProject: true
#  canCreateVersion: true

filterPriorities:
  GitLab: 1
  org.pac4j.j2e.filter.CallbackFilter: 2
  org.pac4j.j2e.filter.SecurityFilter: 3
  CORS: 4

pac4j:
  callbackPrefix: /api/pac4j/login
  clients:
    - org.finos.legend.server.pac4j.gitlab.GitlabClient:
        name: gitlab
        clientId: $APP_ID
        secret: $APP_SECRET
        discoveryUri: https://$GITLAB_HOST/.well-known/openid-configuration
        scope: openid profile api
#  hazelcastSession:
#    enabled: true
#    configFilePath: legend-sdlc-server/src/test/resources/hazelcast.yaml
  bypassPaths:
    - /api/info
    - /api/server/info
    - /api/server/platforms
    - /api/auth/authorized

gitLab:
  newProjectVisibility: public
  projectIdPrefix: SAMPLE
  projectTag: legend
  server:
    scheme: https
    host: $GITLAB_HOST
  app:
    id: $APP_ID
    secret: $APP_SECRET
    redirectURI: http://$SDLC_SERVER_HOST/api/auth/callback

projectStructure:
  extensionProvider:
    org.finos.legend.sdlc.server.gitlab.finos.FinosGitlabProjectStructureExtensionProvider: {}
  platforms:
    legend-engine:
      groupId: org.finos.legend.engine
      platformVersion:
        #version: 3.3.1
        fromPackage: legend-engine-protocol-pure
    legend-sdlc:
      groupId: org.finos.legend.sdlc
      platformVersion:
        #version: 0.77.1
        fromPackage: legend-sdlc-server

logging:
  # Change this to affect library class logging
  level: INFO
  loggers:
    # Change this to affect application class logging
    org.finos.legend.sdlc: INFO
  appenders:
    - type: file
      logFormat: "%d{yyyy-MM-dd HH:mm:ss.SSS} %-5p [%thread] %c - %m%n"
      currentLogFilename: ./logs/service.log
      threshold: ALL
      archive: true
      archivedLogFilenamePattern: ./logs/service-%d.log
      archivedFileCount: 5
      timeZone: UTC
    - type: console
      logFormat: "%d{yyyy-MM-dd HH:mm:ss.SSS} %-5p [%thread] %c - %m%n"

swagger:
  resourcePackage: org.finos.legend.sdlc.server.resources
  title: Legend SDLC
  schemes: []
  `

  this.depotConfigJson =
  `
  {
  "applicationName": "Depot Store Manager API",
  "deployment": "DEV",
  "sessionCookie": "LEGEND_DEPOT_STORE_JSESSIONID",
  "urlPattern": "/depot-store/api/*",
  "server": {
    "type": "simple",
    "applicationContextPath": "/",
    "adminContextPath": "/admin",
    "connector": {
      "type": "http",
      "port": 6201,
      "maxRequestHeaderSize": "32KiB"
    },
    "gzip": {
      "includedMethods": [
        "GET",
        "POST"
      ]
    },
    "requestLog": {
      "appenders": [
        {
          "type": "console",
          "filterFactories": [
            {
              "type": "healthcheck-filter-factory"
            }
          ]
        }
      ]
    }
  },
  "artifactRepositoryProviderConfiguration": {},
  "artifactsRefreshPolicyConfiguration": {},
  "artifactsRetentionPolicyConfiguration": {},
  "projects": {"defaultBranch": "master"},
  "storages": [{
    "org.finos.legend.depot.store.mongo.core.MongoConfiguration": {
      "url": "mongodb://mongo:27017",
      "database": "depot-dev",
      "tracing": false
    }
  }],
  "openTracing": {
    "openTracingUri": "your URL here",
    "serviceName": "legend-depot-store",
    "enabled": false
  },
  "logging": {
    "level": "INFO",
    "loggers": {
      "org.jboss.shrinkwrap.resolver": "off",
      "org.eclipse.aether": "off",
      "Legend Depot Store Manager": {
        "level": "info",
        "appenders": [
          {
            "type": "console",
            "logFormat": "%msg\\r\\n"
          }
        ]
      }
    }
  },
  "swagger": {
    "resourcePackage": "org.finos.legend.depot.store",
    "title": "Legend Depot Store Manager",
    "uriPrefix": "/depot-store/api"
  },
  "pac4j": {
    "callbackPrefix": "/depot-store",
    "bypassPaths": [
      "/depot-store/api/info"
    ],
    "bypassBranches": [
      "/depot-store/api/queue"
    ],
    "clients": [
      {
        "org.finos.legend.server.pac4j.gitlab.GitlabClient": {
          "name": "depot",
          "clientId": "4078a28dfc0f1326394a27fb4c0d8010e0ca39c53e31a74049ecc03a22f11f2c",
          "secret": "gloas-c065bc5a42ca06c07423d295c0727cdf8da6b94ac834a7b1f5079e6548a00289",
          "discoveryUri": "https://gitlab.com/.well-known/openid-configuration",
          "scope": "openid profile api"
        }
      }
    ],
    "mongoAuthorizer": {
      "enabled": false,
      "collection": "allowedUsers"
    },
    "mongoSession": {
      "enabled": false,
      "collection": "userSessions"
    }
  },
  "filterPriorities": {
    "Username": 1,
    "OpenTracingFilter": 2,
    "org.pac4j.j2e.filter.SecurityFilter": 3,
    "org.pac4j.j2e.filter.CallbackFilter": 4,
    "CORS": 5
  },
  "artifactRepositoryProviderConfiguration": {
    "org.finos.legend.depot.services.artifacts.repository.maven.MavenArtifactRepositoryConfiguration": {
      "settingsLocation": "legend-depot-store-server/src/test/resources/sample-repository-settings.xml"
    }
  },
  "queue-interval": 30
}`
    }
}
