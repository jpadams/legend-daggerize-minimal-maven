import {
    dag,
    Container,
    Directory,
	File,
    object,
    func,
} from "@dagger.io/dagger"

@object()
class legendDaggerizeMinimalMaven {
  /**
   * Returns a container for Legend Engine dev
   */
  @func()
  legendEngine(source: Directory, config: File): Container {
    const ubuntuImage = "ubuntu:jammy-20240530"
    // const engineConfigDir = "/root/.legend/"
    // const engineConfig = engineConfigDir + "config.yaml"
    // const gitlabServer = "gitlab.com"
    // const appId = "app-id-placeholder"
    // const appSecret = "app-secret-placeholder"
    // const sdlcServerHost = "localhost"

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
            "openjdk-11-jdk",
            "maven",
            "curl",
            "gettext-base",
            "-y",
        ])
        // maven deps cache
        // did not seem worth it to cache target dirs as build often broke
        .withMountedCache(
            "/root/.m2/repository",
            dag.cacheVolume("legend-engine-mvn-cache")
        )
        // mount source
        .withMountedDirectory("/src", source)
        // needs 8GB of heap to build locally
        .withEnvVariable("MAVEN_OPTS", "-Xmx8192m")
        .withWorkdir("/src")
        .withExec(["mvn", "install", "-DskipTests"])
        //.withFile(engineConfig, config) // /root/.legend/config.yaml
        //.withEnvVariable("GITLAB_HOST", gitlabServer)
        //.withEnvVariable("APP_ID", appId)
        //.withEnvVariable("APP_SECRET", appSecret)
        //.withEnvVariable("SDLC_SERVER_HOST" ,sdlcServerHost)
        //.withExec(["bash", "-c", "envsubst < " + engineConfig + " > " + engineConfig + ".filled"])
		.withExec([
            "bash",
            "-c",
            `java -cp \
            java -cp \
            legend-engine-config/legend-engine-server/legend-engine-server-http-server/target/legend-engine-server-http-server-*-shaded.jar \
            org.finos.legend.engine.server.Server \
            server \
            legend-engine-config/legend-engine-server/legend-engine-server-http-server/config/config.json`
        ])
        .withExposedPort(6300)
    }
}